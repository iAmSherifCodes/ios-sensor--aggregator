import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { DynamoDBRecord } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';

// Types
export interface SensorEvent {
  sensor_id: string;
  timestamp: string;
  type: string;
  value: number;
  location: string;
  environment: string;
}

export interface SensorAggregate {
  sensor_id: string;
  hour_bucket: string;
  avg: number;
  min: number;
  max: number;
  count: number;
  last_updated: string;
  sensor_type: string;
  location: string;
}

export interface AggregateServiceConfig {
  docClient: DynamoDBDocumentClient;
  secretsClient: SecretsManagerClient;
  tableName: string;
  secretArn: string;
  environment: string;
}

export class AggregateService {
  private cachedSecrets: any = null;

  constructor(private config: AggregateServiceConfig) {}

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
   * Truncate timestamp to hour bucket
   */
  getHourBucket(timestamp: string): string {
    const date = new Date(timestamp);
    date.setMinutes(0, 0, 0); // Set minutes, seconds, and milliseconds to 0
    return date.toISOString().slice(0, 16) + ':00'; // Format: YYYY-MM-DDTHH:00:00
  }

  /**
   * Parse DynamoDB record to sensor event
   */
  parseSensorEvent(record: DynamoDBRecord): SensorEvent | null {
    if (!record.dynamodb?.NewImage) {
      return null;
    }

    const sensorEvent = unmarshall(record.dynamodb.NewImage as Record<string, any>) as SensorEvent;
    
    // Validate required fields
    if (!sensorEvent.sensor_id || !sensorEvent.timestamp || typeof sensorEvent.value !== 'number') {
      return null;
    }

    return sensorEvent;
  }

  /**
   * Get existing aggregate from DynamoDB
   */
  async getExistingAggregate(sensor_id: string, hour_bucket: string): Promise<SensorAggregate | null> {
    const getCommand = new GetCommand({
      TableName: this.config.tableName,
      Key: { sensor_id, hour_bucket }
    });

    const result = await this.config.docClient.send(getCommand);
    return result.Item as SensorAggregate || null;
  }

  /**
   * Calculate new aggregate values
   */
  calculateNewAggregate(existing: SensorAggregate, newValue: number): Partial<SensorAggregate> {
    const newCount = existing.count + 1;
    const newSum = (existing.avg * existing.count) + newValue;
    const newAvg = newSum / newCount;
    const newMin = Math.min(existing.min, newValue);
    const newMax = Math.max(existing.max, newValue);

    return {
      avg: Number(newAvg.toFixed(2)),
      min: newMin,
      max: newMax,
      count: newCount
    };
  }

  /**
   * Update existing aggregate
   */
  async updateAggregate(
    sensor_id: string, 
    hour_bucket: string, 
    updates: Partial<SensorAggregate>,
    sensorEvent: SensorEvent
  ): Promise<void> {
    const updateCommand = new UpdateCommand({
      TableName: this.config.tableName,
      Key: { sensor_id, hour_bucket },
      UpdateExpression: 'SET #avg = :avg, #min = :min, #max = :max, #count = :count, last_updated = :updated, #location = :location, sensor_type = :type',
      ExpressionAttributeNames: {
        '#avg': 'avg',
        '#min': 'min',
        '#max': 'max',
        '#count': 'count',
        '#location': 'location'
      },
      ExpressionAttributeValues: {
        ':avg': updates.avg,
        ':min': updates.min,
        ':max': updates.max,
        ':count': updates.count,
        ':updated': new Date().toISOString(),
        ':location': sensorEvent.location,
        ':type': sensorEvent.type
      }
    });

    await this.config.docClient.send(updateCommand);
  }

  /**
   * Create new aggregate
   */
  async createAggregate(sensorEvent: SensorEvent, hour_bucket: string): Promise<void> {
    const newAggregate: SensorAggregate = {
      sensor_id: sensorEvent.sensor_id,
      hour_bucket,
      avg: Number(sensorEvent.value.toFixed(2)),
      min: sensorEvent.value,
      max: sensorEvent.value,
      count: 1,
      last_updated: new Date().toISOString(),
      sensor_type: sensorEvent.type,
      location: sensorEvent.location
    };

    const putCommand = new PutCommand({
      TableName: this.config.tableName,
      Item: newAggregate,
      ConditionExpression: 'attribute_not_exists(sensor_id) AND attribute_not_exists(hour_bucket)'
    });

    await this.config.docClient.send(putCommand);
  }

  /**
   * Process a single sensor event for aggregation
   */
  async processSensorEvent(sensorEvent: SensorEvent): Promise<void> {
    const hourBucket = this.getHourBucket(sensorEvent.timestamp);
    
    // Get secrets (for potential future use)
    await this.getSecrets();

    try {
      const existing = await this.getExistingAggregate(sensorEvent.sensor_id, hourBucket);

      if (existing) {
        // Update existing aggregate
        const updates = this.calculateNewAggregate(existing, sensorEvent.value);
        await this.updateAggregate(sensorEvent.sensor_id, hourBucket, updates, sensorEvent);
        console.log(`Updated aggregate for ${sensorEvent.sensor_id} at ${hourBucket}`);
      } else {
        // Create new aggregate
        await this.createAggregate(sensorEvent, hourBucket);
        console.log(`Created new aggregate for ${sensorEvent.sensor_id} at ${hourBucket}`);
      }
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        // Handle race condition - retry the operation
        console.log('Conditional check failed, retrying...');
        await this.processSensorEvent(sensorEvent);
      } else {
        throw error;
      }
    }
  }

  /**
   * Process DynamoDB record
   */
  async processRecord(record: DynamoDBRecord): Promise<void> {
    // Only process INSERT and MODIFY events
    if (record.eventName !== 'INSERT' && record.eventName !== 'MODIFY') {
      console.log(`Skipping ${record.eventName} event`);
      return;
    }

    const sensorEvent = this.parseSensorEvent(record);
    if (!sensorEvent) {
      console.error('Invalid sensor event data in record');
      return;
    }

    await this.processSensorEvent(sensorEvent);
  }
}
