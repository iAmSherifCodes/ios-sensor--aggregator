#!/bin/bash

# IoT Sensor Aggregator Deployment Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT=${ENVIRONMENT:-dev}
REGION=${CDK_DEFAULT_REGION:-us-east-1}

echo -e "${GREEN}🚀 Deploying IoT Sensor Aggregator${NC}"
echo -e "${YELLOW}Environment: ${ENVIRONMENT}${NC}"
echo -e "${YELLOW}Region: ${REGION}${NC}"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI is not configured or credentials are invalid${NC}"
    exit 1
fi

# Install dependencies
echo -e "${GREEN}📦 Installing dependencies...${NC}"
npm install

# Build TypeScript
echo -e "${GREEN}🔨 Building TypeScript...${NC}"
npm run build

# Bootstrap CDK (if needed)
echo -e "${GREEN}🏗️  Bootstrapping CDK...${NC}"
npx cdk bootstrap --region $REGION

# Deploy the stack
echo -e "${GREEN}🚀 Deploying CDK stack...${NC}"
npx cdk deploy --require-approval never

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"

# Get outputs
echo -e "${GREEN}📋 Stack Outputs:${NC}"
aws cloudformation describe-stacks \
    --stack-name IoTSensorAggregatorStack \
    --region $REGION \
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
    --output table
