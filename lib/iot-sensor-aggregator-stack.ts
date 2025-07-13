import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { AttributeType, BillingMode, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Runtime, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import {RequestValidator, Model, LambdaIntegration, RestApi, Cors, MethodLoggingLevel, JsonSchemaType } from 'aws-cdk-lib/aws-apigateway';
import {PolicyStatement, Effect} from 'aws-cdk-lib/aws-iam';
import {LogGroup, RetentionDays}  from 'aws-cdk-lib/aws-logs';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { Tags } from 'aws-cdk-lib';

export class IoTSensorAggregatorStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Environment variables
    const environment = process.env.ENVIRONMENT || 'dev';
    
    // Create Secrets Manager secret for configuration
    const appSecret = new Secret(this, 'AppSecret', {
      secretName: `iot-sensor-aggregator-${environment}`,
      description: 'Configuration secrets for IoT Sensor Aggregator',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          apiKey: '',
          encryptionKey: ''
        }),
        generateStringKey: 'defaultPassword',
        excludeCharacters: '"@/\\'
      }
    });

    // DynamoDB Tables
    const sensorEventsTable = new Table(this, 'SensorEventsTable', {
      tableName: `SensorEvents-${environment}`,
      partitionKey: {
        name: 'sensor_id',
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'timestamp',
        type: AttributeType.STRING
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      stream: StreamViewType.NEW_AND_OLD_IMAGES,
      pointInTimeRecovery: true,
      removalPolicy: RemovalPolicy.DESTROY // For dev/test environments
    });

    const sensorAggregatesTable = new Table(this, 'SensorAggregatesTable', {
      tableName: `SensorAggregates-${environment}`,
      partitionKey: {
        name: 'sensor_id',
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'hour_bucket',
        type: AttributeType.STRING
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: RemovalPolicy.DESTROY // For dev/test environments
    });

    // Add tags to DynamoDB tables
    Tags.of(sensorEventsTable).add('Purpose', 'SensorEventStorage');
    Tags.of(sensorAggregatesTable).add('Purpose', 'SensorAggregateStorage');

    // CloudWatch Log Groups
    const ingestLogGroup = new LogGroup(this, 'IngestLambdaLogGroup', {
      logGroupName: `/aws/lambda/iot-sensor-ingest-${environment}`,
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const aggregateLogGroup = new LogGroup(this, 'AggregateLambdaLogGroup', {
      logGroupName: `/aws/lambda/iot-sensor-aggregate-${environment}`,
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    });

    // Lambda Functions
    const ingestLambda = new NodejsFunction(this, 'IngestLambda', {
      functionName: `iot-sensor-ingest-${environment}`,
      runtime: Runtime.NODEJS_18_X,
      entry: 'lambda/ingest/index.ts',
      handler: 'handler',
      timeout: Duration.seconds(30),
      memorySize: 256,
      environment: {
        SENSOR_EVENTS_TABLE: sensorEventsTable.tableName,
        SECRET_ARN: appSecret.secretArn,
        ENVIRONMENT: environment
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'es2020',
        externalModules: ['aws-sdk']
      }
    });

    const aggregateLambda = new NodejsFunction(this, 'AggregateLambda', {
      functionName: `iot-sensor-aggregate-${environment}`,
      runtime: Runtime.NODEJS_18_X,
      entry: 'lambda/aggregate/index.ts',
      handler: 'handler',
      timeout: Duration.seconds(60),
      memorySize: 512,
      environment: {
        SENSOR_AGGREGATES_TABLE: sensorAggregatesTable.tableName,
        SECRET_ARN: appSecret.secretArn,
        ENVIRONMENT: environment
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'es2020',
        externalModules: ['aws-sdk']
      }
    });

    // Associate Lambda functions with their log groups
    ingestLambda.node.addDependency(ingestLogGroup);
    aggregateLambda.node.addDependency(aggregateLogGroup);

    // DynamoDB Stream Event Source for Aggregate Lambda
    aggregateLambda.addEventSource(
      new DynamoEventSource(sensorEventsTable, {
        startingPosition: StartingPosition.LATEST,
        batchSize: 10,
        maxBatchingWindow: Duration.seconds(5),
        retryAttempts: 3
      })
    );

    // IAM Permissions
    // Ingest Lambda permissions
    sensorEventsTable.grantWriteData(ingestLambda);
    appSecret.grantRead(ingestLambda);

    // Aggregate Lambda permissions
    sensorAggregatesTable.grantReadWriteData(aggregateLambda);
    sensorEventsTable.grantStreamRead(aggregateLambda);
    appSecret.grantRead(aggregateLambda);

    // Additional CloudWatch Logs permissions
    ingestLambda.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents'
      ],
      resources: [ingestLogGroup.logGroupArn + ':*']
    }));

    aggregateLambda.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents'
      ],
      resources: [aggregateLogGroup.logGroupArn + ':*']
    }));

    // API Gateway
    const api = new RestApi(this, 'SensorApi', {
      restApiName: `iot-sensor-api-${environment}`,
      description: 'IoT Sensor Data Ingestion API',
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key']
      },
      deployOptions: {
        stageName: environment,
        throttlingRateLimit: 1000,
        throttlingBurstLimit: 2000,
        loggingLevel: MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true
      }
    });

    // API Gateway Integration
    const sensorResource = api.root.addResource('sensor');
    const dataResource = sensorResource.addResource('data');
    
    const integration = new LambdaIntegration(ingestLambda, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' }
    });

    dataResource.addMethod('POST', integration, {
      requestValidator: new RequestValidator(this, 'RequestValidator', {
        restApi: api,
        requestValidatorName: 'sensor-data-validator',
        validateRequestBody: true,
        validateRequestParameters: false
      }),
      requestModels: {
        'application/json': new Model(this, 'SensorDataModel', {
          restApi: api,
          modelName: 'SensorDataModel',
          contentType: 'application/json',
          schema: {
            type: JsonSchemaType.OBJECT,
            required: ['sensor_id', 'type', 'value', 'location'],
            properties: {
              sensor_id: { type: JsonSchemaType.STRING },
              type: { type: JsonSchemaType.STRING },
              value: { type: JsonSchemaType.NUMBER },
              location: { type: JsonSchemaType.STRING }
            }
          }
        })
      }
    });

    // Stack Outputs
    new CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL',
      exportName: `iot-sensor-api-endpoint-${environment}`
    });

    new CfnOutput(this, 'SensorEventsTableName', {
      value: sensorEventsTable.tableName,
      description: 'DynamoDB SensorEvents table name',
      exportName: `sensor-events-table-${environment}`
    });

    new CfnOutput(this, 'SensorAggregatesTableName', {
      value: sensorAggregatesTable.tableName,
      description: 'DynamoDB SensorAggregates table name',
      exportName: `sensor-aggregates-table-${environment}`
    });

    new CfnOutput(this, 'SecretArn', {
      value: appSecret.secretArn,
      description: 'Secrets Manager secret ARN',
      exportName: `app-secret-arn-${environment}`
    });
  }
}
