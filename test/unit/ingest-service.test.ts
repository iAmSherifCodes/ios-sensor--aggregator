import { IngestService, SensorData } from '../../lambda/ingest/service';

// Simple mock for testing
const mockDocClient = {
  send: jest.fn()
} as any;

const mockSecretsClient = {
  send: jest.fn()
} as any;

describe('IngestService', () => {
  let ingestService: IngestService;
  const mockConfig = {
    docClient: mockDocClient,
    secretsClient: mockSecretsClient,
    tableName: 'test-table',
    secretArn: 'test-secret-arn',
    environment: 'test'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    ingestService = new IngestService(mockConfig);
  });

  describe('validateSensorData', () => {
    it('should validate correct sensor data', () => {
      const validData: SensorData = {
        sensor_id: 'sensor-123',
        type: 'temperature',
        value: 25.5,
        location: 'lab-1'
      };

      expect(ingestService.validateSensorData(validData)).toBe(true);
    });

    it('should reject data with missing fields', () => {
      const invalidData = {
        sensor_id: 'sensor-123',
        type: 'temperature',
        // missing value and location
      };

      expect(ingestService.validateSensorData(invalidData)).toBe(false);
    });

    it('should reject data with wrong types', () => {
      const invalidData = {
        sensor_id: 'sensor-123',
        type: 'temperature',
        value: '25.5', // should be number
        location: 'lab-1'
      };

      expect(ingestService.validateSensorData(invalidData)).toBe(false);
    });

    it('should reject data with empty strings', () => {
      const invalidData = {
        sensor_id: '',
        type: 'temperature',
        value: 25.5,
        location: 'lab-1'
      };

      expect(ingestService.validateSensorData(invalidData)).toBe(false);
    });
  });

  describe('createSensorEvent', () => {
    it('should create sensor event with provided timestamp', () => {
      const sensorData: SensorData = {
        sensor_id: 'sensor-123',
        type: 'temperature',
        value: 25.5,
        location: 'lab-1'
      };
      const timestamp = '2023-07-13T10:00:00.000Z';

      const result = ingestService.createSensorEvent(sensorData, timestamp);

      expect(result).toEqual({
        ...sensorData,
        timestamp,
        environment: 'test'
      });
    });

    it('should create sensor event with current timestamp when not provided', () => {
      const sensorData: SensorData = {
        sensor_id: 'sensor-123',
        type: 'temperature',
        value: 25.5,
        location: 'lab-1'
      };

      const result = ingestService.createSensorEvent(sensorData);

      expect(result.sensor_id).toBe(sensorData.sensor_id);
      expect(result.type).toBe(sensorData.type);
      expect(result.value).toBe(sensorData.value);
      expect(result.location).toBe(sensorData.location);
      expect(result.environment).toBe('test');
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('getSecrets', () => {
    it('should retrieve and cache secrets', async () => {
      const mockSecrets = { apiKey: 'test-key' };
      mockSecretsClient.send.mockResolvedValue({
        SecretString: JSON.stringify(mockSecrets)
      });

      const result1 = await ingestService.getSecrets();
      const result2 = await ingestService.getSecrets();

      expect(result1).toEqual(mockSecrets);
      expect(result2).toEqual(mockSecrets);
      expect(mockSecretsClient.send).toHaveBeenCalledTimes(1);
    });

    it('should handle secrets retrieval error', async () => {
      mockSecretsClient.send.mockRejectedValue(new Error('Access denied'));

      const result = await ingestService.getSecrets();

      expect(result).toEqual({});
    });
  });

  describe('storeSensorEvent', () => {
    it('should store sensor event in DynamoDB', async () => {
      const sensorEvent = {
        sensor_id: 'sensor-123',
        type: 'temperature',
        value: 25.5,
        location: 'lab-1',
        timestamp: '2023-07-13T10:00:00.000Z',
        environment: 'test'
      };

      mockDocClient.send.mockResolvedValue({});

      await ingestService.storeSensorEvent(sensorEvent);

      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });

    it('should handle DynamoDB errors', async () => {
      const sensorEvent = {
        sensor_id: 'sensor-123',
        type: 'temperature',
        value: 25.5,
        location: 'lab-1',
        timestamp: '2023-07-13T10:00:00.000Z',
        environment: 'test'
      };

      mockDocClient.send.mockRejectedValue(new Error('DynamoDB error'));

      await expect(ingestService.storeSensorEvent(sensorEvent)).rejects.toThrow('DynamoDB error');
    });
  });

  describe('processSensorData', () => {
    it('should process valid sensor data successfully', async () => {
      const sensorData: SensorData = {
        sensor_id: 'sensor-123',
        type: 'temperature',
        value: 25.5,
        location: 'lab-1'
      };

      mockSecretsClient.send.mockResolvedValue({
        SecretString: JSON.stringify({})
      });
      mockDocClient.send.mockResolvedValue({});

      const result = await ingestService.processSensorData(sensorData);

      expect(result.sensor_id).toBe(sensorData.sensor_id);
      expect(result.type).toBe(sensorData.type);
      expect(result.value).toBe(sensorData.value);
      expect(result.location).toBe(sensorData.location);
      expect(result.environment).toBe('test');
      expect(result.timestamp).toBeDefined();
    });

    it('should reject invalid sensor data', async () => {
      const invalidData = {
        sensor_id: 'sensor-123',
        // missing required fields
      };

      await expect(ingestService.processSensorData(invalidData)).rejects.toThrow(
        'Invalid sensor data format. Required fields: sensor_id, type, value, location'
      );
    });

    it('should handle storage errors', async () => {
      const sensorData: SensorData = {
        sensor_id: 'sensor-123',
        type: 'temperature',
        value: 25.5,
        location: 'lab-1'
      };

      mockSecretsClient.send.mockResolvedValue({
        SecretString: JSON.stringify({})
      });
      mockDocClient.send.mockRejectedValue(new Error('Storage failed'));

      await expect(ingestService.processSensorData(sensorData)).rejects.toThrow('Storage failed');
    });
  });
});
