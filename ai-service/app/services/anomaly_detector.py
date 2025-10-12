"""
Anomaly Detection Service using ML algorithms
Detects unusual patterns in forensic data
"""

import numpy as np
from typing import List, Dict, Any, Tuple
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import DBSCAN
import pandas as pd
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """ML-based anomaly detection for forensic data"""

    def __init__(self):
        self.isolation_forest = IsolationForest(
            contamination=0.1,
            random_state=42,
            n_estimators=100
        )
        self.scaler = StandardScaler()

    def detect_communication_anomalies(self, communication_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Detect anomalous communication patterns using Isolation Forest

        Args:
            communication_data: List of communication records with features

        Returns:
            List of detected anomalies with confidence scores
        """
        try:
            if len(communication_data) < 10:
                logger.warning("Insufficient data for anomaly detection")
                return []

            # Extract features for ML
            features_df = self._extract_communication_features(communication_data)

            if features_df.empty:
                return []

            # Scale features
            feature_columns = ['frequency', 'duration', 'hour_of_day', 'is_foreign', 'contact_diversity']
            X = features_df[feature_columns].values
            X_scaled = self.scaler.fit_transform(X)

            # Fit and predict anomalies
            self.isolation_forest.fit(X_scaled)
            anomaly_scores = self.isolation_forest.decision_function(X_scaled)
            predictions = self.isolation_forest.predict(X_scaled)

            # Process results
            anomalies = []
            for i, (pred, score) in enumerate(zip(predictions, anomaly_scores)):
                if pred == -1:  # Anomaly detected
                    record = communication_data[i]
                    confidence = min(abs(score) * 2, 1.0)  # Convert to 0-1 scale

                    anomaly_type = self._classify_anomaly(record, features_df.iloc[i])

                    anomalies.append({
                        'record': record,
                        'anomaly_score': score,
                        'confidence': confidence,
                        'anomaly_type': anomaly_type,
                        'features': features_df.iloc[i].to_dict()
                    })

            # Sort by confidence
            anomalies.sort(key=lambda x: x['confidence'], reverse=True)

            logger.info(f"Detected {len(anomalies)} communication anomalies")
            return anomalies[:10]  # Return top 10 anomalies

        except Exception as e:
            logger.error(f"Error in communication anomaly detection: {e}")
            return []

    def detect_temporal_anomalies(self, temporal_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Detect temporal anomalies in communication patterns

        Args:
            temporal_data: Time-series communication data

        Returns:
            List of temporal anomalies
        """
        try:
            if len(temporal_data) < 20:
                return []

            # Group by hour and detect unusual spikes
            hourly_counts = {}
            for record in temporal_data:
                if 'timestamp' in record:
                    hour = pd.to_datetime(record['timestamp']).hour
                    hourly_counts[hour] = hourly_counts.get(hour, 0) + 1

            # Calculate statistics
            counts = list(hourly_counts.values())
            mean_count = np.mean(counts)
            std_count = np.std(counts)

            anomalies = []
            for hour, count in hourly_counts.items():
                if std_count > 0:
                    z_score = (count - mean_count) / std_count
                    if z_score > 2.5:  # 2.5 standard deviations
                        confidence = min(z_score / 5, 1.0)
                        anomalies.append({
                            'hour': hour,
                            'count': count,
                            'z_score': z_score,
                            'confidence': confidence,
                            'anomaly_type': 'temporal_spike',
                            'description': f'Unusual activity spike at hour {hour} ({count} communications)'
                        })

            return sorted(anomalies, key=lambda x: x['confidence'], reverse=True)

        except Exception as e:
            logger.error(f"Error in temporal anomaly detection: {e}")
            return []

    def detect_network_anomalies(self, network_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Detect anomalies in communication networks using clustering

        Args:
            network_data: Network relationship data

        Returns:
            List of network anomalies
        """
        try:
            if len(network_data) < 5:
                return []

            # Create feature matrix for clustering
            features = []
            for record in network_data:
                features.append([
                    record.get('degree_centrality', 0),
                    record.get('betweenness_centrality', 0),
                    record.get('communication_frequency', 0),
                    record.get('unique_contacts', 0)
                ])

            X = np.array(features)

            if X.shape[0] < 5:
                return []

            # Use DBSCAN for density-based clustering
            dbscan = DBSCAN(eps=0.5, min_samples=2)
            clusters = dbscan.fit_predict(X)

            # Find outliers (noise points)
            anomalies = []
            for i, cluster in enumerate(clusters):
                if cluster == -1:  # Noise/outlier
                    record = network_data[i]
                    # Calculate outlier score based on distance to nearest cluster
                    distances = np.linalg.norm(X - X[i], axis=1)
                    min_distance = np.min(distances[distances > 0])

                    confidence = min(1.0, min_distance * 2)

                    anomalies.append({
                        'record': record,
                        'confidence': confidence,
                        'anomaly_type': 'network_outlier',
                        'description': f'Network outlier: {record.get("phone_number", "unknown")} has unusual connection pattern',
                        'features': {
                            'degree_centrality': record.get('degree_centrality', 0),
                            'betweenness_centrality': record.get('betweenness_centrality', 0),
                            'communication_frequency': record.get('communication_frequency', 0),
                            'unique_contacts': record.get('unique_contacts', 0)
                        }
                    })

            return sorted(anomalies, key=lambda x: x['confidence'], reverse=True)

        except Exception as e:
            logger.error(f"Error in network anomaly detection: {e}")
            return []

    def _extract_communication_features(self, data: List[Dict[str, Any]]) -> pd.DataFrame:
        """Extract ML features from communication data"""
        try:
            features = []

            for record in data:
                # Basic features
                frequency = record.get('frequency', 1)
                duration = record.get('duration', 0)

                # Time-based features
                hour_of_day = 12  # Default
                if 'timestamp' in record and record['timestamp']:
                    try:
                        dt = pd.to_datetime(record['timestamp'])
                        hour_of_day = dt.hour
                    except:
                        pass

                # Geographic features
                is_foreign = 0
                phone = record.get('phone_number', '')
                if phone.startswith('+') and not phone.startswith('+91'):
                    is_foreign = 1

                # Contact diversity (simplified)
                contact_diversity = min(record.get('unique_contacts', 1), 10) / 10.0

                features.append({
                    'frequency': frequency,
                    'duration': duration,
                    'hour_of_day': hour_of_day,
                    'is_foreign': is_foreign,
                    'contact_diversity': contact_diversity
                })

            return pd.DataFrame(features)

        except Exception as e:
            logger.error(f"Error extracting communication features: {e}")
            return pd.DataFrame()

    def _classify_anomaly(self, record: Dict[str, Any], features: pd.Series) -> str:
        """Classify the type of anomaly detected"""
        try:
            # Rule-based classification
            if features.get('is_foreign', 0) == 1 and features.get('frequency', 0) > 10:
                return 'frequent_foreign_communication'

            if features.get('hour_of_day', 12) in [1, 2, 3, 4, 5] and features.get('frequency', 0) > 5:
                return 'late_night_activity'

            if features.get('contact_diversity', 0) > 0.8:
                return 'high_contact_diversity'

            if features.get('frequency', 0) > 20:
                return 'high_frequency_communication'

            return 'general_anomaly'

        except Exception as e:
            logger.error(f"Error classifying anomaly: {e}")
            return 'unknown_anomaly'

    def detect_all_anomalies(self, case_data: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
        """
        Comprehensive anomaly detection across all data types

        Args:
            case_data: Dictionary containing different types of case data

        Returns:
            Dictionary with different types of anomalies detected
        """
        results = {
            'communication_anomalies': [],
            'temporal_anomalies': [],
            'network_anomalies': [],
            'summary': {}
        }

        try:
            # Communication anomalies
            if 'communications' in case_data:
                results['communication_anomalies'] = self.detect_communication_anomalies(
                    case_data['communications']
                )

            # Temporal anomalies
            if 'temporal_data' in case_data:
                results['temporal_anomalies'] = self.detect_temporal_anomalies(
                    case_data['temporal_data']
                )

            # Network anomalies
            if 'network_data' in case_data:
                results['network_anomalies'] = self.detect_network_anomalies(
                    case_data['network_data']
                )

            # Generate summary
            total_anomalies = (
                len(results['communication_anomalies']) +
                len(results['temporal_anomalies']) +
                len(results['network_anomalies'])
            )

            results['summary'] = {
                'total_anomalies': total_anomalies,
                'high_confidence_count': sum(
                    1 for anomaly in results['communication_anomalies'] + results['temporal_anomalies'] + results['network_anomalies']
                    if anomaly.get('confidence', 0) > 0.7
                ),
                'anomaly_types': list(set(
                    [a.get('anomaly_type', 'unknown') for anomalies in results.values() if isinstance(anomalies, list) for a in anomalies]
                )),
                'risk_level': self._calculate_overall_risk(results)
            }

            logger.info(f"Anomaly detection completed: {total_anomalies} anomalies found")
            return results

        except Exception as e:
            logger.error(f"Error in comprehensive anomaly detection: {e}")
            return results

    def _calculate_overall_risk(self, results: Dict[str, List[Dict[str, Any]]]) -> str:
        """Calculate overall risk level based on anomalies detected"""
        total_anomalies = results['summary'].get('total_anomalies', 0)
        high_confidence = results['summary'].get('high_confidence_count', 0)

        if high_confidence >= 5 or total_anomalies >= 10:
            return 'critical'
        elif high_confidence >= 3 or total_anomalies >= 7:
            return 'high'
        elif high_confidence >= 1 or total_anomalies >= 4:
            return 'medium'
        elif total_anomalies >= 1:
            return 'low'
        else:
            return 'none'


# Global instance
anomaly_detector = AnomalyDetector()
