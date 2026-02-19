# Prequeue Entry Not Found - Root Cause & Fix

## Problem
The error "Prequeue entry not found" was occurring when trying to approve, decline, or check the status of prequeue entries. This happened because the database layer was using `sql.js`, an in-memory SQLite implementation, which caused race conditions and data persistence issues.

## Root Cause
The application was using `sql.js` (an in-memory SQLite database) instead of a proper persistent SQLite driver. This caused several issues:

1. **Race Conditions** - When a prequeue entry was created, it was saved to memory and then written to disk asynchronously. If a subsequent request came in before the disk write completed, the entry wouldn't be found.

2. **Database State Inconsistency** - The `getDb()` function created a new wrapper each time, but the underlying database object was shared. This led to timing issues between memory and disk.

3. **No Transaction Support** - `sql.js` doesn't handle concurrent operations well, especially with multiple simultaneous requests.

## Solution
Replaced `sql.js` with `better-sqlite3`, a proper synchronous SQLite driver that:
- Provides immediate, synchronous database operations
- Eliminates race conditions through proper locking
- Supports transactions natively
- Persists data reliably to disk

## Changes Made

### 1. Updated package.json
- Removed: `"sql.js": "^1.8.0"`
- Added: `"better-sqlite3": "^9.2.2"`

### 2. Rewrote server/db.js
- Replaced `sql.js` with `better-sqlite3`
- Simplified database initialization (no more async/await needed)
- Removed manual save/load logic (better-sqlite3 handles this automatically)
- Enabled foreign key constraints for data integrity
- Consolidated column creation into table definitions

## Installation
After pulling these changes, run:
```bash
npm install
```

This will install `better-sqlite3` which requires compilation. On macOS, you'll need:
- Xcode Command Line Tools (usually already installed)
- Python 3.x

If you encounter build issues, ensure you have the required build tools installed.

## Testing
After installation, the prequeue system should work reliably:
1. Submit a track for prequeue approval
2. Approve/decline the track via the admin panel or Slack
3. The entry should be found and processed without errors

## Benefits
- ✅ Eliminates "Prequeue entry not found" errors
- ✅ Faster database operations (synchronous)
- ✅ Better concurrency handling
- ✅ More reliable data persistence
- ✅ Native transaction support
