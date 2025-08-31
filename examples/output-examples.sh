#!/bin/bash
# TaskSmith Output Management CLI Examples for Bash
# Usage: ./output-examples.sh <example_type>
# Examples: basic, monitoring, debugging, export, performance

set -euo pipefail

EXAMPLE_TYPE="${1:-basic}"

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${MAGENTA}TaskSmith Output Management CLI Examples${NC}"
    echo -e "${MAGENTA}=======================================${NC}"
}

print_section() {
    echo -e "\n${CYAN}=== $1 ===${NC}"
}

print_subsection() {
    echo -e "\n${GREEN}--- $1 ---${NC}"
}

show_basic_example() {
    print_section "Basic Configuration Example"
    echo -e "${GREEN}Use case: Simple script execution with basic streaming and progress${NC}"
    
    echo -e "\n${YELLOW}Configuration JSON:${NC}"
    cat << 'EOF'
{
  "streaming": {
    "stdout": {
      "maxLines": 500,
      "retentionMs": 60000,
      "maxMemoryBytes": 524288
    },
    "stderr": {
      "maxLines": 250,
      "retentionMs": 30000,
      "maxMemoryBytes": 262144
    },
    "errorPatterns": ["error:", "fail"],
    "warningPatterns": ["warn:", "warning"]
  },
  "progress": {
    "enabled": true,
    "style": "spinner",
    "updateIntervalMs": 100,
    "showETA": false,
    "showPhase": true
  }
}
EOF

    show_usage_examples
}

show_monitoring_example() {
    print_section "Performance Monitoring Configuration"
    echo -e "${GREEN}Use case: Performance monitoring and resource tracking${NC}"
    
    echo -e "\n${YELLOW}Configuration JSON:${NC}"
    cat << 'EOF'
{
  "streaming": {
    "stdout": {
      "maxLines": 2000,
      "retentionMs": 300000,
      "maxMemoryBytes": 2097152
    },
    "stderr": {
      "maxLines": 1000,
      "retentionMs": 180000,
      "maxMemoryBytes": 1048576
    },
    "errorPatterns": ["error", "timeout", "memory", "cpu"],
    "warningPatterns": ["slow", "performance", "warn"]
  },
  "progress": {
    "enabled": true,
    "style": "bar",
    "updateIntervalMs": 200,
    "showETA": true,
    "showPhase": true
  },
  "formatting": {
    "colorScheme": "dark",
    "syntaxHighlighting": true,
    "timestampFormat": "elapsed",
    "includeMetadata": true
  },
  "filtering": {
    "levels": ["info", "warn", "error"],
    "keywords": ["performance", "memory", "time"]
  },
  "caching": {
    "maxEntries": 20,
    "maxMemoryBytes": 5242880,
    "ttlMs": 300000,
    "compression": true,
    "persistToDisk": false
  }
}
EOF

    show_usage_examples
}

show_debugging_example() {
    print_section "Debugging Configuration"
    echo -e "${GREEN}Use case: Comprehensive error analysis and troubleshooting${NC}"
    
    echo -e "\n${YELLOW}Configuration JSON:${NC}"
    cat << 'EOF'
{
  "streaming": {
    "stdout": {
      "maxLines": 5000,
      "retentionMs": 600000,
      "maxMemoryBytes": 10485760
    },
    "stderr": {
      "maxLines": 2000,
      "retentionMs": 600000,
      "maxMemoryBytes": 5242880
    },
    "errorPatterns": ["error", "exception", "fail", "fatal", "assertion"],
    "warningPatterns": ["warn", "warning", "deprecated", "caution"]
  },
  "progress": {
    "enabled": true,
    "style": "dots",
    "updateIntervalMs": 500,
    "showETA": true,
    "showPhase": true
  },
  "formatting": {
    "colorScheme": "dark",
    "syntaxHighlighting": true,
    "timestampFormat": "iso",
    "includeMetadata": true
  },
  "filtering": {
    "levels": ["debug", "info", "warn", "error"],
    "excludeKeywords": ["trace"]
  },
  "caching": {
    "maxEntries": 50,
    "maxMemoryBytes": 20971520,
    "ttlMs": 600000,
    "compression": true,
    "persistToDisk": true
  }
}
EOF

    show_usage_examples
}

show_export_example() {
    print_section "Export Configuration"
    echo -e "${GREEN}Use case: Output capture for reporting and documentation${NC}"
    
    echo -e "\n${YELLOW}Configuration JSON:${NC}"
    cat << 'EOF'
{
  "streaming": {
    "stdout": {
      "maxLines": 1000,
      "retentionMs": 120000,
      "maxMemoryBytes": 1048576
    },
    "stderr": {
      "maxLines": 500,
      "retentionMs": 60000,
      "maxMemoryBytes": 524288
    },
    "errorPatterns": ["error:", "fail"],
    "warningPatterns": ["warn:", "warning"]
  },
  "formatting": {
    "colorScheme": "none",
    "syntaxHighlighting": false,
    "timestampFormat": "iso",
    "includeMetadata": true
  },
  "export": {
    "format": "html",
    "includeMetadata": true,
    "compress": false,
    "streaming": false
  },
  "caching": {
    "maxEntries": 30,
    "maxMemoryBytes": 10485760,
    "ttlMs": 300000,
    "compression": false,
    "persistToDisk": true
  }
}
EOF

    show_usage_examples
}

show_performance_example() {
    print_section "High-Performance Configuration"
    echo -e "${GREEN}Use case: High-volume output processing with optimization${NC}"
    
    echo -e "\n${YELLOW}Configuration JSON:${NC}"
    cat << 'EOF'
{
  "streaming": {
    "stdout": {
      "maxLines": 10000,
      "retentionMs": 180000,
      "maxMemoryBytes": 20971520
    },
    "stderr": {
      "maxLines": 2000,
      "retentionMs": 90000,
      "maxMemoryBytes": 5242880
    },
    "errorPatterns": ["error", "fail", "exception"],
    "warningPatterns": ["warn", "slow"]
  },
  "progress": {
    "enabled": true,
    "style": "bar",
    "updateIntervalMs": 1000,
    "showETA": true,
    "showPhase": false
  },
  "formatting": {
    "colorScheme": "none",
    "syntaxHighlighting": false,
    "timestampFormat": "none",
    "includeMetadata": false
  },
  "caching": {
    "maxEntries": 100,
    "maxMemoryBytes": 104857600,
    "ttlMs": 600000,
    "compression": true,
    "persistToDisk": true
  }
}
EOF

    show_usage_examples
}

show_usage_examples() {
    echo -e "\n${YELLOW}Node.js/TypeScript Usage:${NC}"
    cat << 'EOF'
const result = await taskManager.runScript({
  name: 'my-script',
  args: ['arg1', 'arg2']
}, configJson);
EOF

    echo -e "\n${YELLOW}Bash/cURL Example:${NC}"
    cat << 'EOF'
curl -X POST http://localhost:3000/mcp/runScript \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-script",
    "args": ["arg1", "arg2"],
    "outputOptions": <CONFIG_JSON_HERE>
  }'
EOF
}

show_scenario_examples() {
    print_section "Real-World Scenario Examples"
    
    print_subsection "CI/CD Pipeline"
    echo "Description: Continuous integration with test reporting"
    echo "Recommended Config: monitoring"
    echo "Example Scripts:"
    echo "  • npm run test"
    echo "  • docker build ."
    echo "  • kubectl apply -f deployment.yaml"
    
    print_subsection "Data Processing"
    echo "Description: Large dataset processing with progress tracking"
    echo "Recommended Config: performance"
    echo "Example Scripts:"
    echo "  • python process_data.py --input large_dataset.csv"
    echo "  • spark-submit --class MainApp data_processor.jar"
    echo "  • hadoop jar mapreduce.jar input/ output/"
    
    print_subsection "Debugging & Troubleshooting"
    echo "Description: Problem diagnosis with comprehensive logging"
    echo "Recommended Config: debugging"
    echo "Example Scripts:"
    echo "  • systemctl status myservice"
    echo "  • docker logs container_name"
    echo "  • tail -f /var/log/application.log"
    
    print_subsection "Report Generation"
    echo "Description: Creating formatted reports for documentation"
    echo "Recommended Config: export"
    echo "Example Scripts:"
    echo "  • pytest --html=report.html"
    echo "  • npm audit --json > security_report.json"
    echo "  • terraform plan -out=plan.tfplan"
}

show_comparison_table() {
    print_section "Configuration Comparison"
    
    echo -e "${YELLOW}Configuration Comparison Table:${NC}"
    printf "%-12s %-10s %-12s %-12s %-10s %-8s %-8s\n" \
           "Config" "Max Lines" "Retention" "Memory" "Progress" "Cache" "Export"
    echo "------------------------------------------------------------------------"
    printf "%-12s %-10s %-12s %-12s %-10s %-8s %-8s\n" \
           "basic" "500" "1.0 min" "0.5 MB" "spinner" "No" "No"
    printf "%-12s %-10s %-12s %-12s %-10s %-8s %-8s\n" \
           "monitoring" "2000" "5.0 min" "2.0 MB" "bar" "Yes" "No"
    printf "%-12s %-10s %-12s %-12s %-10s %-8s %-8s\n" \
           "debugging" "5000" "10.0 min" "10.0 MB" "dots" "Yes" "No"
    printf "%-12s %-10s %-12s %-12s %-10s %-8s %-8s\n" \
           "export" "1000" "2.0 min" "1.0 MB" "spinner" "Yes" "html"
    printf "%-12s %-10s %-12s %-12s %-10s %-8s %-8s\n" \
           "performance" "10000" "3.0 min" "20.0 MB" "bar" "Yes" "No"
}

show_performance_tips() {
    print_section "Performance Optimization Tips"
    
    print_subsection "Memory Management"
    echo "  • Set maxLines based on expected output volume"
    echo "  • Use shorter retentionMs for high-frequency scripts"
    echo "  • Enable compression for long-running processes"
    echo "  • Monitor memory usage through metrics APIs"
    
    print_subsection "Processing Speed"
    echo "  • Increase updateIntervalMs for less frequent updates"
    echo "  • Use 'silent' progress style for batch jobs"
    echo "  • Disable syntax highlighting for large outputs"
    echo "  • Use 'none' color scheme to reduce processing"
    
    print_subsection "Filtering Efficiency"
    echo "  • Use specific error patterns to reduce false positives"
    echo "  • Configure appropriate log levels to filter noise"
    echo "  • Use excludeKeywords to remove unwanted content"
    echo "  • Limit regex patterns to essential matches only"
    
    print_subsection "Caching Strategy"
    echo "  • Enable compression for frequently accessed results"
    echo "  • Set appropriate TTL based on data freshness needs"
    echo "  • Use persistToDisk for long-term result storage"
    echo "  • Monitor cache hit rates and adjust maxEntries"
}

show_quick_start() {
    print_section "Quick Start Commands"
    echo -e "${YELLOW}Run different examples:${NC}"
    echo "  ./output-examples.sh basic"
    echo "  ./output-examples.sh monitoring"
    echo "  ./output-examples.sh debugging"
    echo "  ./output-examples.sh export"
    echo "  ./output-examples.sh performance"
    
    echo -e "\n${GREEN}For more information, see:${NC}"
    echo "  • docs/OUTPUT-MANAGEMENT.md - Complete documentation"
    echo "  • src/types/index.ts - TypeScript interface definitions"
    echo "  • test/integration.test.ts - Integration test examples"
}

# Main execution
print_header

case "${EXAMPLE_TYPE}" in
    basic)
        show_basic_example
        ;;
    monitoring)
        show_monitoring_example
        ;;
    debugging)
        show_debugging_example
        ;;
    export)
        show_export_example
        ;;
    performance)
        show_performance_example
        ;;
    *)
        echo -e "${RED}Invalid example type: ${EXAMPLE_TYPE}${NC}"
        echo "Valid options: basic, monitoring, debugging, export, performance"
        exit 1
        ;;
esac

show_comparison_table
show_scenario_examples
show_performance_tips
show_quick_start