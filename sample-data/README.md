# UFDR Sample Files for System Testing

This directory contains 5 comprehensive UFDR (Universal Forensic Data Reader) sample files designed to thoroughly test all features and functionalities of the UFDR Analysis Tool system.

## 📁 Sample Files Overview

### 1. `sample_mobile_device.ufdr` - Mobile Device Investigation
**Case**: iPhone 13 Pro forensic extraction
**Focus**: Communications, location tracking, app data, and device artifacts

**Key Test Features**:
- ✅ SMS/MMS messages (50+ messages with timestamps)
- ✅ Call logs (100+ calls with durations)
- ✅ Email communications (25+ emails)
- ✅ GPS location data (200+ location points over 24 hours)
- ✅ App installations and usage (15+ apps)
- ✅ Browser history (75+ visits)
- ✅ WiFi networks and Bluetooth devices
- ✅ Media files (photos, videos with EXIF data)
- ✅ System logs (150+ entries)
- ✅ Encrypted backups

**Anomaly Detection Tests**:
- Late night activity spikes (2-4 AM)
- Unusual app usage patterns
- Foreign communications
- Location anomalies

### 2. `sample_computer_forensic.ufdr` - Computer Forensic Investigation
**Case**: Windows 11 workstation forensic extraction
**Focus**: File system analysis, registry forensics, and network artifacts

**Key Test Features**:
- ✅ File system artifacts (500+ files with metadata)
- ✅ Windows registry keys (75+ keys)
- ✅ Email data (85+ messages)
- ✅ Browser history and downloads (200+ visits, 45 downloads)
- ✅ Network connections (300+ connections)
- ✅ Firewall logs (25 rules)
- ✅ Installed applications (35+ apps)
- ✅ System event logs (500+ events)
- ✅ USB device history (8 devices)
- ✅ Scheduled tasks (15 tasks)
- ✅ Encrypted volumes (BitLocker)

**Anomaly Detection Tests**:
- Suspicious file access patterns
- Unusual network connections
- Registry anomalies
- Hidden file detection

### 3. `sample_network_traffic.ufdr` - Network Traffic Investigation
**Case**: Corporate firewall network capture
**Focus**: Packet analysis, firewall rules, and network forensics

**Key Test Features**:
- ✅ Firewall rules (150+ rules with hit counts)
- ✅ Firewall logs (2000+ log entries)
- ✅ Packet captures (5000+ packets)
- ✅ Network conversations (200+ TCP sessions)
- ✅ DNS queries (1500+ resolutions)
- ✅ HTTP/HTTPS traffic (800+ requests)
- ✅ SSL/TLS sessions (300+ handshakes)
- ✅ Application protocols (20+ protocol types)
- ✅ Threat detections (25+ security events)
- ✅ Network anomalies (15+ detected anomalies)

**Anomaly Detection Tests**:
- Dark web access attempts
- Unusual traffic spikes
- Suspicious port usage
- Protocol anomalies

### 4. `sample_cloud_service.ufdr` - Cloud Service Investigation
**Case**: Multi-platform cloud service forensics
**Focus**: Cloud storage, email, social media, and cloud logs

**Key Test Features**:
- ✅ Email accounts (Gmail, Outlook with 200+ messages)
- ✅ Cloud storage (Dropbox, Google Drive with 300+ files)
- ✅ Social media (Facebook, Twitter with posts, messages)
- ✅ Access logs (400+ authentication events)
- ✅ Activity logs (300+ service interactions)
- ✅ Two-factor authentication setup
- ✅ Security events (25+ incidents)
- ✅ Shared files and permissions
- ✅ File versions and backups

**Anomaly Detection Tests**:
- Unusual login locations
- Suspicious file sharing
- Account security breaches
- Abnormal usage patterns

### 5. `sample_iot_device.ufdr` - IoT Device Investigation
**Case**: Smart home ecosystem forensic analysis
**Focus**: IoT device communications, sensor data, and device forensics

**Key Test Features**:
- ✅ IoT device inventory (25+ devices)
- ✅ Device communications (500+ MQTT/HTTPS messages)
- ✅ Sensor readings (2000+ sensor data points)
- ✅ Device events (300+ events)
- ✅ Media recordings (70+ security videos/audio)
- ✅ Network connections (WiFi and Bluetooth)
- ✅ Firmware analysis (vulnerability scanning)
- ✅ Privacy policies and data collection
- ✅ Forensic artifacts (40+ device databases/logs)
- ✅ Device anomalies (15+ detected issues)

**Anomaly Detection Tests**:
- Unusual device communications
- Sensor data anomalies
- Firmware vulnerabilities
- Privacy breaches

## 🔬 Testing Scenarios

### Core Functionality Testing
1. **UFDR Ingestion**: Upload each file and verify parsing
2. **Entity Extraction**: Check automatic extraction of phones, emails, crypto addresses
3. **Report Generation**: Generate all 6 report types for each case
4. **Natural Language Queries**: Test RAG with conversation memory

### Multi-Database Architecture Testing
1. **PostgreSQL**: Verify case management, user data, and relationships
2. **Elasticsearch**: Test full-text search across all data types
3. **Neo4j**: Check entity relationships and graph queries
4. **Redis**: Verify caching and background job processing

### Cross-Case Intelligence Testing
1. **Entity Linking**: Upload multiple files and test entity connections
2. **Shared Entities**: Verify automatic detection of common entities
3. **Case Relationships**: Test graph-based case linking
4. **Cross-Case Search**: Query across all uploaded cases

### Automated Alert System Testing
1. **Rule-Based Alerts**: Verify alert generation from uploaded data
2. **Alert Management**: Test alert creation, updates, and resolution
3. **Real-time Alerts**: Check live alert notifications
4. **Alert Analytics**: Test alert reporting and trends

### ML Anomaly Detection Testing
1. **Communication Anomalies**: Test with mobile device and network data
2. **Temporal Anomalies**: Check time-based pattern detection
3. **Network Anomalies**: Verify graph-based anomaly detection
4. **Deep Learning**: Test neural network anomaly detection

### Predictive Analytics Testing
1. **Risk Assessment**: Generate risk scores for cases
2. **Investigation Leads**: Check AI-generated suggestions
3. **Similar Cases**: Test case similarity matching
4. **Model Training**: Verify ML model training and updates

### Integration Ecosystem Testing
1. **Webhook Processing**: Test external tool integrations
2. **Bulk Operations**: Verify large-scale data processing
3. **Data Transformation**: Test format conversions
4. **Real-time Sync**: Check live data synchronization

### Performance & Scalability Testing
1. **Rate Limiting**: Test API rate limiting under load
2. **Caching**: Verify Redis caching performance
3. **Background Jobs**: Test async processing capabilities
4. **Monitoring**: Check system performance metrics

### Advanced AI Features Testing
1. **Evidence Classification**: Test ML-based categorization
2. **Pattern Recognition**: Verify advanced pattern discovery
3. **Model Training**: Test AI model training pipelines
4. **Comprehensive Analysis**: Run full AI analysis suite

## 📊 Expected Test Results

### File Upload Success
- All 5 files should upload and parse successfully
- No parsing errors or data corruption
- Complete metadata extraction

### Database Population
- PostgreSQL: 100+ records across all tables
- Elasticsearch: 2000+ indexed documents
- Neo4j: 500+ nodes and relationships
- Redis: Active caching and job queues

### Feature Functionality
- 100% of core features operational
- All 6 report types generated successfully
- Natural language queries working with context
- Cross-case intelligence fully functional

### AI Performance
- Anomaly detection: 4+ anomalies detected per file
- Evidence classification: 80%+ accuracy
- Pattern recognition: 6+ pattern types identified
- Risk assessment: Meaningful risk scores generated

### Performance Metrics
- API response time: <500ms for cached queries
- Report generation: <30 seconds for comprehensive reports
- Bulk operations: <60 seconds for large datasets
- Real-time sync: <5 seconds for data updates

## 🚀 Usage Instructions

1. **Start the System**: Ensure all services are running (backend, AI service, databases)

2. **Upload Files**: Upload each UFDR file through the web interface

3. **Run Analysis**: Execute comprehensive analysis on each case

4. **Test Queries**: Perform natural language queries across cases

5. **Generate Reports**: Create all report types for each investigation

6. **Monitor Performance**: Check system metrics and performance indicators

7. **Test Integrations**: Verify webhook processing and external tool integration

## 📈 Coverage Metrics

These sample files provide **100% feature coverage** for testing:

- **Data Types**: 15+ different forensic data categories
- **File Formats**: XML/UFDR structured data
- **Investigation Types**: 5 comprehensive forensic scenarios
- **Anomaly Scenarios**: 20+ different anomaly patterns
- **Timeline Coverage**: 24+ hours of continuous activity
- **Entity Relationships**: 100+ interconnected data points
- **Security Scenarios**: 15+ security incidents and breaches

The sample files are designed to **stress-test every component** of the UFDR system while providing realistic forensic data for meaningful analysis and reporting.
