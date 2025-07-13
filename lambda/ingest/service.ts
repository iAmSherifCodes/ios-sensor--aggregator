import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// Types
export interface SensorData {
  sensor_id: string;
  type: string;
  value: number;
  location: string;
}

export interface SensorEvent extends SensorData {
  timestamp: string;
  environment: string;
}

export interface IngestServiceConfig {
  docClient: DynamoDBDocumentClient;
  secretsClient: SecretsManagerClient;
  tableName: string;
  secretArn: string;
  environment: string;
}

export class IngestService {
  private cachedSecrets: any = null;

  constructor(private config: IngestServiceConfig) {}

  /**
   * Get secrets from AWS Secrets Manager with caching
   */
  async getSecrets(): Promise<any> {
    if (this.cachedSecrets) {
      return this.cachedSecrets;
    }

    try {
      const command = new GetSecretValueCommand({
        SecretId: this.config.secretArn
      });
      
      const response = await this.config.secretsClient.send(command);
      this.cachedSecrets = JSON.parse(response.SecretString || '{}');
      return this.cachedSecrets;
    } catch (error) {
      console.error('Error retrieving secrets:', error);
      return {};
    }
  }

  /**
   * Validate sensor data
   */
  validateSensorData(data: any): data is SensorData {
    return (
      typeof data === 'object' &&
      typeof data.sensor_id === 'string' &&
      typeof data.type === 'string' &&
      typeof data.value === 'number' &&
      typeof data.location === 'string' &&
      data.sensor_id.trim() !== '' &&
      data.type.trim() !== '' &&
      data.location.trim() !== ''
    );
  }

  /**
   * Create sensor event with timestamp
   */
  createSensorEvent(sensorData: SensorData, timestamp?: string): SensorEvent {
    return {
      ...sensorData,
      timestamp: timestamp || new Date().toISOString(),
      environment: this.config.environment
    };
  }

  /**
   * Store sensor event in DynamoDB
   */
  async storeSensorEvent(sensorEvent: SensorEvent): Promise<void> {
    const putCommand = new PutCommand({
      TableName: this.config.tableName,
      Item: sensorEvent,
      ConditionExpression: 'attribute_not_exists(sensor_id) AND attribute_not_exists(#ts)',
      ExpressionAttributeNames: {
        '#ts': 'timestamp'
      }
    });

    await this.config.docClient.send(putCommand);
  }

  /**
   * Process sensor data - main business logic
   */
  async processSensorData(sensorData: any): Promise<SensorEvent> {
    if (!this.validateSensorData(sensorData)) {
      throw new Error('Invalid sensor data format. Required fields: sensor_id, type, value, location');
    }
    
    await this.getSecrets();

    const sensorEvent = this.createSensorEvent(sensorData);
    await this.storeSensorEvent(sensorEvent);

    console.log('Successfully stored sensor event:', sensorEvent);
    return sensorEvent;
  }
}
