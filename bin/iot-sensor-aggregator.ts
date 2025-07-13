#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { IoTSensorAggregatorStack } from '../lib/iot-sensor-aggregator-stack';

const app = new cdk.App();

// Environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Stack configuration
const stackProps = {
  env,
  description: 'Serverless IoT Sensor Event Aggregator',
  tags: {
    Project: 'IoTSensorAggregator',
    Environment: process.env.ENVIRONMENT || 'dev',
  },
};

new IoTSensorAggregatorStack(app, 'IoTSensorAggregatorStack', stackProps);
