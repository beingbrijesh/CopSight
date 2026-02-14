#!/bin/bash

# UFDR - Universal Forensic Data Repository
# Pitch Script Runner

echo "🎯 UFDR: Revolutionizing Digital Forensics"
echo "========================================="
echo ""

# Function to display text with typing effect
type_text() {
    text="$1"
    delay="${2:-0.03}"
    for ((i=0; i<${#text}; i++)); do
        echo -n "${text:$i:1}"
        sleep $delay
    done
    echo ""
}

# Introduction
type_text "Imagine a world where digital evidence analysis is no longer bottlenecked by manual processes..." 0.05
echo ""
sleep 1

# The Problem
type_text "🔴 THE PROBLEM:" 0.03
type_text "Digital forensics investigators spend 80% of their time on repetitive data extraction and manual correlation." 0.04
type_text "UFDR files from Cellebrite and other tools contain mountains of evidence, but analyzing them is painfully slow." 0.04
echo ""
sleep 1

# The Solution
type_text "✅ THE SOLUTION: UFDR - Universal Forensic Data Repository" 0.03
echo ""
type_text "An AI-powered forensic analysis platform that transforms how investigators process and analyze digital evidence." 0.04
echo ""
sleep 1

# Key Features
type_text "🚀 KEY FEATURES:" 0.03
echo ""
type_text "• 🤖 AI-Powered Entity Extraction - Automatically identifies people, locations, devices, and crypto addresses" 0.03
type_text "• 🔗 Cross-Case Intelligence - Connects evidence across multiple investigations" 0.03
type_text "• 📊 Advanced Analytics - ML anomaly detection and predictive insights" 0.03
type_text "• ⚡ Real-time Processing - Handles massive UFDR files with intelligent queuing" 0.03
type_text "• 🔍 Semantic Search - Natural language queries across all evidence" 0.03
type_text "• 📈 Visual Analytics - Interactive timelines, graphs, and evidence mapping" 0.03
echo ""
sleep 1

# Technical Excellence
type_text "🛠️ BUILT FOR SCALE:" 0.03
echo ""
type_text "• PostgreSQL + Redis + Elasticsearch + Neo4j stack" 0.03
type_text "• Containerized microservices architecture" 0.03
type_text "• Enterprise-grade security and audit trails" 0.03
type_text "• RESTful APIs for seamless integration" 0.03
echo ""
sleep 1

# Market Opportunity
type_text "📈 MARKET OPPORTUNITY:" 0.03
echo ""
type_text "• Global digital forensics market: $8.2B (2024)" 0.03
type_text "• Growing at 13.5% CAGR through 2030" 0.03
type_text "• Law enforcement, corporate investigations, e-discovery" 0.03
type_text "• First-mover advantage in AI-powered forensic analysis" 0.03
echo ""
sleep 1

# Competitive Advantage
type_text "🎯 COMPETITIVE ADVANTAGE:" 0.03
echo ""
type_text "• Patented AI entity extraction algorithms" 0.03
type_text "• Native UFDR support (vs competitors' manual imports)" 0.03
type_text "• Cross-case correlation capabilities" 0.03
type_text "• Open-source friendly with enterprise licensing" 0.03
echo ""
sleep 1

# Call to Action
type_text "🌟 READY TO TRANSFORM FORENSICS?" 0.03
echo ""
type_text "Join us in revolutionizing digital evidence analysis." 0.04
type_text "From hours to minutes. From manual to automatic. From reactive to predictive." 0.04
echo ""
type_text "📧 Contact: [Your Contact Information]" 0.03
type_text "🌐 Demo: [Demo URL]" 0.03
type_text "📱 GitHub: [Repository URL]" 0.03
echo ""
sleep 1

# Closing
type_text "UFDR: Because justice shouldn't wait for data processing." 0.05
echo ""
type_text "Thank you." 0.1
