# IoT Sensor Aggregator - Test Suite

This directory contains tests for the IoT Sensor Aggregator system.

## Test Structure

```
test/
├── unit/                           # Unit tests - test individual functions/modules
│   └── ingest-service.test.ts     # Tests for ingest service logic
├── iot-sensor-aggregator.test.ts  # Infrastructure tests (CDK stack)
└── README.md                      # This file
```

## Test Types

### 1. Unit Tests (`test/unit/`)

Unit tests focus on testing individual functions and modules in isolation using mocks.

**Characteristics:**
- Fast execution (< 30 seconds per test)
- No external dependencies (AWS services are mocked)
- Test business logic directly by importing modules
- High code coverage
- Run in any environment

**What they test:**
- Service layer business logic
- Data validation functions
- Error handling
- Edge cases and boundary conditions

### 2. Infrastructure Tests

Tests that validate the CDK stack configuration and ensure all AWS resources are properly defined.

## Running Tests

### Prerequisites

```bash
# Install dependencies
npm install
```

### Unit Tests
```bash
# Run all unit tests
npm run test:unit

# Run specific unit test file
npx jest test/unit/ingest-service.test.ts

# Run unit tests with coverage
npm run test:coverage
```

### All Tests
```bash
# Run all tests (unit + infrastructure)
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage
```

## Test Configuration

### Test Timeouts
- Unit tests: 30 seconds
- Infrastructure tests: 30 seconds

## Writing New Tests

### Unit Test Guidelines

1. **Import the module directly:**
```typescript
import { IngestService } from '../../lambda/ingest/service';
```

2. **Mock AWS services using Jest:**
```typescript
const mockDocClient = {
  send: jest.fn()
} as any;
```

3. **Test business logic in isolation:**
```typescript
it('should validate correct sensor data', () => {
  const result = ingestService.validateSensorData(validData);
  expect(result).toBe(true);
});
```

## Test Data Management

### Unit Tests
- Use deterministic test data
- Mock all external dependencies
- Clean up mocks between tests

## Debugging Tests

### Enable Verbose Output
```bash
npx jest --verbose
```

### Run Single Test
```bash
npx jest test/unit/ingest-service.test.ts --verbose
```

## Best Practices

1. **Fast Feedback**: Unit tests provide quick feedback during development
2. **Independent Tests**: Each test should be able to run independently
3. **Clear Naming**: Test names should clearly describe what is being tested
4. **Proper Cleanup**: Mock cleanup in unit tests
5. **Error Testing**: Test both success and failure scenarios

## Troubleshooting

### Common Issues

1. **Unit tests failing with import errors**
   - Ensure TypeScript is compiled: `npm run build`
   - Check import paths are correct

2. **Mock-related errors in unit tests**
   - Ensure mocks are reset between tests
   - Check mock setup matches the actual usage

### Getting Help

- Check test output for specific error messages
- Use `--verbose` flag for detailed test execution logs
