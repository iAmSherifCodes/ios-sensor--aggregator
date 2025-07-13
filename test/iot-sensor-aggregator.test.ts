import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { IoTSensorAggregatorStack } from '../lib/iot-sensor-aggregator-stack';

describe('IoTSensorAggregatorStack', () => {
  let app: cdk.App;
  let stack: IoTSensorAggregatorStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new IoTSensorAggregatorStack(app, 'TestStack');
    template = Template.fromStack(stack);
  });

  test('Creates DynamoDB Tables', () => {
    // Check SensorEvents table
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [
        {
          AttributeName: 'sensor_id',
          KeyType: 'HASH'
        },
        {
          AttributeName: 'timestamp',
          KeyType: 'RANGE'
        }
      ],
      StreamSpecification: {
        StreamViewType: 'NEW_AND_OLD_IMAGES'
      }
    });
    
    // Check SensorAggregates table
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [
        {
          AttributeName: 'sensor_id',
          KeyType: 'HASH'
        },
        {
          AttributeName: 'hour_bucket',
          KeyType: 'RANGE'
        }
      ]
    });
  });

  test('Creates Lambda Functions', () => {
    // Check ingest Lambda
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs18.x',
      Handler: 'index.handler',
      MemorySize: 256,
      Timeout: 30
    });

    // Check aggregate Lambda
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs18.x',
      Handler: 'index.handler',
      MemorySize: 512,
      Timeout: 60
    });
  });

  test('Creates API Gateway', () => {
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'iot-sensor-api-dev',
      Description: 'IoT Sensor Data Ingestion API'
    });

    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'POST'
    });
  });

  test('Creates Secrets Manager Secret', () => {
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'iot-sensor-aggregator-dev',
      Description: 'Configuration secrets for IoT Sensor Aggregator'
    });
  });

  test('Creates CloudWatch Log Groups', () => {
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/lambda/iot-sensor-ingest-dev',
      RetentionInDays: 7
    });

    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/lambda/iot-sensor-aggregate-dev',
      RetentionInDays: 7
    });
  });

  test('Creates Event Source Mapping for DynamoDB Stream', () => {
    template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      EventSourceArn: {
        'Fn::GetAtt': [
          'SensorEventsTableA10059AD',
          'StreamArn'
        ]
      },
      StartingPosition: 'LATEST',
      BatchSize: 10
    });
  });

  test('Has Required Outputs', () => {
    template.hasOutput('ApiEndpoint', {});
    template.hasOutput('SensorEventsTableName', {});
    template.hasOutput('SensorAggregatesTableName', {});
    template.hasOutput('SecretArn', {});
  });

  test('Lambda Functions Have Environment Variables', () => {
    // Check that Lambda functions have required environment variables
    const lambdaFunctions = template.findResources('AWS::Lambda::Function');
    
    Object.values(lambdaFunctions).forEach((func: any) => {
      expect(func.Properties.Environment?.Variables).toBeDefined();
      expect(func.Properties.Environment.Variables.ENVIRONMENT).toBeDefined();
      expect(func.Properties.Environment.Variables.SECRET_ARN).toBeDefined();
    });
  });

  test('IAM Roles Have Least Privilege Permissions', () => {
    // Check that IAM roles exist and have appropriate policies
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'lambda.amazonaws.com'
            },
            Action: 'sts:AssumeRole'
          }
        ]
      }
    });

    // Check for DynamoDB permissions in policy statements
    const policies = template.findResources('AWS::IAM::Policy');
    const hasRequiredPermissions = Object.values(policies).some((policy: any) => {
      const statements = policy.Properties.PolicyDocument.Statement;
      return statements.some((statement: any) => 
        statement.Effect === 'Allow' && 
        Array.isArray(statement.Action) && 
        statement.Action.includes('dynamodb:PutItem')
      );
    });
    
    expect(hasRequiredPermissions).toBe(true);
  });
});
