import { DynamoDBStreamEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { AggregateService } from './service';

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const secretsClient = new SecretsManagerClient({});

// Environment variables
const SENSOR_AGGREGATES_TABLE = process.env.SENSOR_AGGREGATES_TABLE!;
const SECRET_ARN = process.env.SECRET_ARN!;
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

// Initialize service
const aggregateService = new AggregateService({
  docClient,
  secretsClient,
  tableName: SENSOR_AGGREGATES_TABLE,
  secretArn: SECRET_ARN,
  environment: ENVIRONMENT
});

/**
 * Main Lambda handler
 */
export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  console.log('Received DynamoDB Stream event:', JSON.stringify(event, null, 2));

  try {
    // Process each record in the batch
    const promises = event.Records.map(record => aggregateService.processRecord(record));
    await Promise.allSettled(promises);

    console.log(`Successfully processed ${event.Records.length} records`);

  } catch (error) {
    console.error('Error processing DynamoDB Stream event:', error);
    throw error; // This will cause the Lambda to retry
  }
};
