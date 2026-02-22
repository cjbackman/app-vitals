// Mock for better-sqlite3 — used by jest.mock("better-sqlite3") in tests
export const mockRun = jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 });
export const mockAll = jest.fn().mockReturnValue([]);
export const mockGet = jest.fn().mockReturnValue(undefined);
export const mockExec = jest.fn();
export const mockPrepare = jest.fn().mockReturnValue({
  run: mockRun,
  all: mockAll,
  get: mockGet,
});

const MockDatabase = jest.fn().mockImplementation(() => ({
  prepare: mockPrepare,
  exec: mockExec,
}));

export default MockDatabase;
