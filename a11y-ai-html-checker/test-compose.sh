#!/bin/bash
set -e

echo "🧪 Running Accessibility Checker via Docker Compose"
echo "=================================================="
echo ""

# Verificar se samples/ existe e tem arquivos
if [ ! -d "samples" ] || [ -z "$(ls -A samples/*.html 2>/dev/null)" ]; then
    echo "❌ Error: No HTML files found in ./samples/"
    echo "   Please add HTML files to analyze before running."
    exit 1
fi

echo "📂 HTML files found:"
ls -1 samples/*.html | sed 's/samples\//   - /'
echo ""

# Executar análise
echo "🚀 Starting analysis..."
echo ""

docker-compose -f docker-compose-teste.yaml up --abort-on-container-exit

# Verificar se relatórios foram gerados
echo ""
echo "=================================================="
if ls reports/consolidated_a11y_report_*.html 1> /dev/null 2>&1; then
    echo "✅ Analysis completed successfully!"
    echo ""
    echo "📊 Generated reports:"
    ls -lh reports/ | grep -E '\.(json|html)$' | awk '{print "   - " $9 " (" $5 ")"}'
    echo ""
    echo "💡 Open consolidated report:"
    echo "   open reports/consolidated_a11y_report_*.html"
    echo "   (or xdg-open on Linux)"
else
    echo "❌ Error: No reports generated"
    echo "   Check logs above for errors"
    exit 1
fi
