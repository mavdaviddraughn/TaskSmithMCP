#!/bin/bash

# Test runner script with clean environment
set -e

echo "🧪 Running TaskSmith MCP Tests in Clean Environment"
echo "================================================="

# Function to run specific tests
run_test() {
    local test_name="$1"
    local test_file="$2"
    
    echo "🔄 Running $test_name..."
    
    # Create completely fresh container for each test
    docker-compose -f docker-compose.test.yml run --rm test-runner npx vitest run "$test_file" --reporter=verbose
    
    local exit_code=$?
    if [ $exit_code -eq 0 ]; then
        echo "✅ $test_name passed"
    else
        echo "❌ $test_name failed (exit code: $exit_code)"
        return $exit_code
    fi
}

# Parse arguments
case "$1" in
    "crud")
        echo "Running CRUD operations tests..."
        run_test "CRUD Operations" "test/script-crud.test.ts"
        ;;
    "git")
        echo "Running Git integration tests..."
        run_test "Git Integration" "test/git-integration.test.ts"
        ;;
    "all")
        echo "Running all tests..."
        docker-compose -f docker-compose.test.yml run --rm test-runner npm test
        ;;
    "watch")
        echo "Starting test watcher..."
        docker-compose -f docker-compose.test.yml up test-watch
        ;;
    "shell")
        echo "Opening test shell..."
        docker-compose -f docker-compose.test.yml run --rm test-shell
        ;;
    *)
        echo "Usage: $0 {crud|git|all|watch|shell}"
        echo ""
        echo "Commands:"
        echo "  crud   - Run CRUD operation tests in clean environment"
        echo "  git    - Run Git integration tests in clean environment"
        echo "  all    - Run all tests"
        echo "  watch  - Start test watcher"
        echo "  shell  - Open interactive shell in test environment"
        echo ""
        echo "Examples:"
        echo "  $0 crud      # Test CRUD operations"
        echo "  $0 all       # Run full test suite"
        echo "  $0 shell     # Debug test environment"
        exit 1
        ;;
esac