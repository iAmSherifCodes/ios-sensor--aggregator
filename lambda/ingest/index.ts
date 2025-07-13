import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { IngestService, SensorData } from './service';

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const secretsClient = new SecretsManagerClient({});

// Environment variables
const SENSOR_EVENTS_TABLE = process.env.SENSOR_EVENTS_TABLE!;
const SECRET_ARN = process.env.SECRET_ARN!;
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

// Initialize service
const ingestService = new IngestService({
  docClient,
  secretsClient,
  tableName: SENSOR_EVENTS_TABLE,
  secretArn: SECRET_ARN,
  environment: ENVIRONMENT
});

/**
 * Create response object
 */
function createResponse(statusCode: number, body: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
      'Access-Control-Allow-Methods': 'POST,OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

/**
 * Main Lambda handler
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  try {
    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
      return createResponse(200, { message: 'CORS preflight successful' });
    }

    // Validate HTTP method
    if (event.httpMethod !== 'POST') {
      return createResponse(405, { 
        error: 'Method not allowed',
        message: 'Only POST method is supported'
      });
    }

    // Parse request body
    if (!event.body) {
      return createResponse(400, { 
        error: 'Bad request',
        message: 'Request body is required'
      });
    }

    let sensorData: SensorData;
    try {
      sensorData = JSON.parse(event.body);
    } catch (parseError) {
      return createResponse(400, { 
        error: 'Bad request',
        message: 'Invalid JSON in request body'
      });
    }

    // Process sensor data using service
    const sensorEvent = await ingestService.processSensorData(sensorData);

    // Return success response
    return createResponse(201, {
      message: 'Sensor data ingested successfully',
      data: {
        sensor_id: sensorEvent.sensor_id,
        timestamp: sensorEvent.timestamp,
        type: sensorEvent.type,
        location: sensorEvent.location
      }
    });

  } catch (error: any) {
    console.error('Error processing sensor data:', error);

    // Handle validation errors
    if (error.message.includes('Invalid sensor data format')) {
      return createResponse(400, { 
        error: 'Validation error',
        message: error.message
      });
    }

    // Handle DynamoDB conditional check failures
    if (error.name === 'ConditionalCheckFailedException') {
      return createResponse(409, {
        error: 'Conflict',
        message: 'Sensor event with this sensor_id and timestamp already exists'
      });
    }

    // Handle other AWS service errors
    if (error.name && error.message) {
      return createResponse(500, {
        error: 'Internal server error',
        message: 'Failed to process sensor data',
        details: ENVIRONMENT === 'dev' ? error.message : undefined
      });
    }

    // Generic error response
    return createResponse(500, {
      error: 'Internal server error',
      message: 'An unexpected error occurred'
    });
  }
};
