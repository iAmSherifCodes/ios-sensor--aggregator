# IoT Sensor Event Aggregator

A serverless IoT sensor data ingestion and aggregation system built with AWS CDK (TypeScript). This system provides real-time sensor data collection through REST API and automatic hourly aggregation using DynamoDB Streams.

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Sensors   │───▶│ API Gateway │───▶│   Lambda    │───▶│  DynamoDB   │
│             │    │             │    │  (Ingest)   │    │ SensorEvents│
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                  │
                                                                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  DynamoDB   │◀───│   Lambda    │◀───│  DynamoDB   │    │             │
│SensorAggr.. │    │(Aggregate)  │    │   Streams   │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

## Features

### 🔄 Data Ingestion
- REST API endpoint for sensor data collection
- JSON schema validation
- Automatic timestamp generation
- Error handling and validation

### 📊 Data Aggregation  
- Real-time stream processing with DynamoDB Streams
- Hourly aggregation buckets
- Statistical calculations (avg, min, max, count)
- Automatic updates for existing aggregates

### 🔒 Security & Best Practices
- Least privilege IAM permissions
- AWS Secrets Manager integration
- Environment-based configuration
- CloudWatch logging and monitoring

### 🚀 Infrastructure as Code
- AWS CDK with TypeScript
- Environment-specific deployments
- Automated bundling with esbuild
- Idempotent deployments

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- AWS CLI configured with appropriate permissions
- AWS CDK CLI installed (`npm install -g aws-cdk`)

### Installation

1. **Clone and setup the project:**
```bash
cd /home/cash/Documents/codes/iot-sensor-aggregator
npm install
```

2. **Configure environment (optional):**
```bash
cp .env.example .env
# Edit .env with your preferred settings
```

3. **Deploy the stack:**
```bash
# Using the deployment script
./scripts/deploy.sh

# Or manually
npm run build
npx cdk bootstrap  # First time only
npx cdk deploy
```

4. **Test the API:**
```bash
# Get the API endpoint from stack outputs
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name IoTSensorAggregatorStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)

# Run tests
./scripts/test-api.sh $API_ENDPOINT
```

## API Usage

### Endpoint
```
POST /sensor/data
```

### Request Format
```json
{
  "sensor_id": "sensor-123",
  "type": "temperature",
  "value": 24.5,
  "location": "lab-1"
}
```

### Response Format
```json
{
  "message": "Sensor data ingested successfully",
  "data": {
    "sensor_id": "sensor-123",
    "timestamp": "2025-07-13T14:00:00.000Z",
    "type": "temperature",
    "location": "lab-1"
  }
}
```

### Example Usage

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "sensor_id": "temp-001",
    "type": "temperature", 
    "value": 23.5,
    "location": "office-a"
  }' \
  https://your-api-id.execute-api.region.amazonaws.com/dev/sensor/data
```

## Data Models

### SensorEvents Table
- **Partition Key**: `sensor_id` (String)
- **Sort Key**: `timestamp` (String, ISO format)
- **Attributes**: `type`, `value`, `location`, `environment`
- **Stream**: Enabled (NEW_AND_OLD_IMAGES)


### SensorAggregates Table  
- **Partition Key**: `sensor_id` (String)
- **Sort Key**: `hour_bucket` (String, format: "2025-07-13T14:00")
- **Attributes**: `avg`, `min`, `max`, `count`, `last_updated`, `sensor_type`, `location`

## Environment Configuration

The system supports multiple environments through environment variables:

```bash
export ENVIRONMENT=dev|staging|prod
export CDK_DEFAULT_REGION=us-east-1
export CDK_DEFAULT_ACCOUNT=123456789012
```

## Monitoring & Observability

### CloudWatch Logs
- `/aws/lambda/iot-sensor-ingest-{env}`
- `/aws/lambda/iot-sensor-aggregate-{env}`

### CloudWatch Metrics
- API Gateway request/error metrics
- Lambda invocation/duration/error metrics  
- DynamoDB read/write capacity metrics

### Alarms (Recommended)
```bash
# Example: Create alarm for Lambda errors
aws cloudwatch put-metric-alarm \
  --alarm-name "IoT-Ingest-Lambda-Errors" \
  --alarm-description "Lambda function errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --dimensions Name=FunctionName,Value=iot-sensor-ingest-dev
```

## Development

### Project Structure
```
├── bin/                    # CDK app entry point
├── lib/                    # CDK stack definitions
├── lambda/                 # Lambda function code
│   ├── ingest/            # Data ingestion Lambda
│   └── aggregate/         # Data aggregation Lambda
├── scripts/               # Deployment and testing scripts
├── test/                  # Unit tests
└── README.md
```

### Local Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Watch for changes
npm run watch

# Synthesize CloudFormation
npm run synth
```

### Testing

```bash
# Run unit tests
npm test

# Test API endpoints
./scripts/test-api.sh <API_ENDPOINT>

# View logs
aws logs tail /aws/lambda/iot-sensor-ingest-dev --follow
```

## Deployment

### Manual Deployment
```bash
npm run build
npx cdk deploy --require-approval never
```

### Automated Deployment
```bash
./scripts/deploy.sh
```

### Environment-Specific Deployment
```bash
ENVIRONMENT=staging ./scripts/deploy.sh
```

## Cost Optimization

### DynamoDB
- Uses on-demand billing for variable workloads
- Point-in-time recovery enabled for data protection
- Consider switching to provisioned capacity for predictable workloads

### Lambda
- Right-sized memory allocation (256MB ingest, 512MB aggregate)
- Efficient bundling with esbuild reduces cold start times
- Connection reuse for AWS SDK clients

### API Gateway
- Request/response caching can be enabled for read-heavy workloads
- Consider usage plans for rate limiting

## Security Considerations

### IAM Permissions
- Least privilege access for all resources
- Separate roles for each Lambda function
- No wildcard permissions

### Data Protection
- Secrets stored in AWS Secrets Manager
- CloudWatch Logs retention configured
- DynamoDB encryption at rest (default)

### Network Security
- API Gateway with CORS configured
- Lambda functions in default VPC (consider custom VPC for production)

## Troubleshooting

### Common Issues

1. **Deployment Failures**
   ```bash
   # Check CDK bootstrap
   npx cdk bootstrap
   
   # Verify AWS credentials
   aws sts get-caller-identity
   ```

2. **Lambda Timeout Errors**
   ```bash
   # Check CloudWatch Logs
   aws logs tail /aws/lambda/iot-sensor-ingest-dev --follow
   ```

3. **DynamoDB Throttling**
   ```bash
   # Monitor metrics
   aws cloudwatch get-metric-statistics \
     --namespace AWS/DynamoDB \
     --metric-name ConsumedReadCapacityUnits \
     --dimensions Name=TableName,Value=SensorEvents-dev
   ```

### Debug Mode
Set `ENVIRONMENT=dev` for detailed error messages in API responses.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review CloudWatch Logs
3. Create an issue in the repository

---

**Built with ❤️ using AWS CDK and TypeScript**
