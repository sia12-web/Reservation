// Test setup file
process.env.NODE_ENV = 'test';

// Mock uuid module to avoid ESM issues with uuid v13
const mockV4 = jest.fn(() => '00000000-0000-4000-8000-000000000000');

jest.mock('uuid', () => ({
  v4: mockV4,
  default: { v4: mockV4 },
}));
