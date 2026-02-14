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
        Detect temporal anomalies in communication patterns with enhanced statistical analysis

        Args:
            temporal_data: Time-series communication data

        Returns:
            List of temporal anomalies with detailed analysis
        """
        try:
            if len(temporal_data) < 20:
                return []

            # Enhanced temporal analysis
            anomalies = []

            # 1. Hourly activity spikes
            hourly_anomalies = self._detect_hourly_spikes(temporal_data)
            anomalies.extend(hourly_anomalies)

            # 2. Day-of-week anomalies
            daily_anomalies = self._detect_daily_pattern_anomalies(temporal_data)
            anomalies.extend(daily_anomalies)

            # 3. Sudden burst detection
            burst_anomalies = self._detect_communication_bursts(temporal_data)
            anomalies.extend(burst_anomalies)

            # 4. Time gap analysis
            gap_anomalies = self._detect_unusual_gaps(temporal_data)
            anomalies.extend(gap_anomalies)

            # Sort by confidence and remove duplicates
            anomalies.sort(key=lambda x: x['confidence'], reverse=True)

            # Remove duplicates based on anomaly type and time window
            unique_anomalies = self._deduplicate_temporal_anomalies(anomalies)

            logger.info(f"Detected {len(unique_anomalies)} temporal anomalies")
            return unique_anomalies[:15]  # Return top 15 anomalies

        except Exception as e:
            logger.error(f"Error in temporal anomaly detection: {e}")
            return []

    def detect_network_anomalies(self, network_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Detect anomalies in communication networks with advanced graph analysis

        Args:
            network_data: Network relationship data

        Returns:
            List of network anomalies with graph metrics
        """
        try:
            if len(network_data) < 5:
                return []

            anomalies = []

            # 1. Centrality-based anomalies
            centrality_anomalies = self._detect_centrality_anomalies(network_data)
            anomalies.extend(centrality_anomalies)

            # 2. Clustering coefficient anomalies
            cluster_anomalies = self._detect_cluster_anomalies(network_data)
            anomalies.extend(cluster_anomalies)

            # 3. Bridge detection (important connections)
            bridge_anomalies = self._detect_bridge_anomalies(network_data)
            anomalies.extend(bridge_anomalies)

            # 4. Isolated node anomalies
            isolation_anomalies = self._detect_isolation_anomalies(network_data)
            anomalies.extend(isolation_anomalies)

            # Sort by confidence
            anomalies.sort(key=lambda x: x['confidence'], reverse=True)

            logger.info(f"Detected {len(anomalies)} network anomalies")
            return anomalies[:12]  # Return top 12 anomalies

        except Exception as e:
            logger.error(f"Error in network anomaly detection: {e}")
            return []

    def _detect_hourly_spikes(self, temporal_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Detect unusual spikes in hourly communication activity"""
        try:
            hourly_counts = {}
            for record in temporal_data:
                if 'timestamp' in record and record['timestamp']:
                    try:
                        dt = pd.to_datetime(record['timestamp'])
                        hour = dt.hour
                        hourly_counts[hour] = hourly_counts.get(hour, 0) + 1
                    except:
                        continue

            if len(hourly_counts) < 12:  # Need at least half day data
                return []

            counts = list(hourly_counts.values())
            mean_count = np.mean(counts)
            std_count = np.std(counts)

            anomalies = []
            for hour, count in hourly_counts.items():
                if std_count > 0:
                    z_score = (count - mean_count) / std_count
                    if z_score > 2.5:  # 2.5 standard deviations
                        confidence = min(abs(z_score) / 5, 1.0)

                        # Determine anomaly type based on hour
                        anomaly_type = self._classify_hourly_anomaly(hour, z_score)

                        anomalies.append({
                            'anomaly_type': anomaly_type,
                            'confidence': confidence,
                            'description': f'Unusual activity spike at {hour:02d}:00 ({count} communications, {z_score:.2f}σ from mean)',
                            'hour': hour,
                            'count': count,
                            'z_score': z_score,
                            'expected_count': mean_count,
                            'time_window': f"{hour:02d}:00-{hour+1:02d}:00"
                        })

            return anomalies

        except Exception as e:
            logger.error(f"Error detecting hourly spikes: {e}")
            return []

    def _detect_daily_pattern_anomalies(self, temporal_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Detect anomalies in day-of-week patterns"""
        try:
            daily_counts = {}
            for record in temporal_data:
                if 'timestamp' in record and record['timestamp']:
                    try:
                        dt = pd.to_datetime(record['timestamp'])
                        day = dt.day_name()
                        daily_counts[day] = daily_counts.get(day, 0) + 1
                    except:
                        continue

            if len(daily_counts) < 5:  # Need multiple days
                return []

            counts = list(daily_counts.values())
            mean_count = np.mean(counts)
            std_count = np.std(counts)

            anomalies = []
            for day, count in daily_counts.items():
                if std_count > 0:
                    z_score = (count - mean_count) / std_count
                    if abs(z_score) > 2.0:  # 2.0 standard deviations
                        confidence = min(abs(z_score) / 4, 1.0)
                        direction = "high" if z_score > 0 else "low"

                        anomalies.append({
                            'anomaly_type': f'unusual_{direction}_activity_day',
                            'confidence': confidence,
                            'description': f'Unusually {direction} activity on {day} ({count} communications, {z_score:.2f}σ from mean)',
                            'day': day,
                            'count': count,
                            'z_score': z_score,
                            'expected_count': mean_count
                        })

            return anomalies

        except Exception as e:
            logger.error(f"Error detecting daily pattern anomalies: {e}")
            return []

    def _detect_communication_bursts(self, temporal_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Detect sudden bursts of communication activity"""
        try:
            # Sort by timestamp
            sorted_data = sorted(temporal_data, key=lambda x: x.get('timestamp', ''))

            if len(sorted_data) < 10:
                return []

            # Calculate rolling averages and detect bursts
            window_size = max(5, len(sorted_data) // 10)  # Adaptive window
            anomalies = []

            for i in range(window_size, len(sorted_data) - window_size):
                # Calculate local statistics
                local_window = sorted_data[i-window_size:i+window_size]
                center_value = 1  # Each record represents 1 communication
                local_mean = len(local_window) / (2 * window_size)
                local_std = np.std([1] * len(local_window) + [0] * window_size)  # Simplified

                if local_std > 0:
                    burst_score = (center_value - local_mean) / local_std

                    if burst_score > 3.0:  # Strong burst
                        confidence = min(burst_score / 6, 1.0)

                        anomalies.append({
                            'anomaly_type': 'communication_burst',
                            'confidence': confidence,
                            'description': f'Sudden communication burst detected around {sorted_data[i].get("timestamp", "unknown time")}',
                            'burst_score': burst_score,
                            'window_size': window_size,
                            'local_density': len(local_window) / (2 * window_size)
                        })

            return anomalies

        except Exception as e:
            logger.error(f"Error detecting communication bursts: {e}")
            return []

    def _detect_unusual_gaps(self, temporal_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Detect unusual gaps in communication patterns"""
        try:
            sorted_data = sorted(temporal_data, key=lambda x: x.get('timestamp', ''))

            if len(sorted_data) < 5:
                return []

            gaps = []
            for i in range(1, len(sorted_data)):
                try:
                    current_time = pd.to_datetime(sorted_data[i].get('timestamp'))
                    prev_time = pd.to_datetime(sorted_data[i-1].get('timestamp'))

                    gap_hours = (current_time - prev_time).total_seconds() / 3600

                    if gap_hours > 1:  # Gaps longer than 1 hour
                        gaps.append({
                            'gap_hours': gap_hours,
                            'start_time': sorted_data[i-1].get('timestamp'),
                            'end_time': sorted_data[i].get('timestamp'),
                            'records_before': i,
                            'records_after': len(sorted_data) - i
                        })
                except:
                    continue

            if not gaps:
                return []

            # Find anomalies in gap distribution
            gap_lengths = [g['gap_hours'] for g in gaps]
            mean_gap = np.mean(gap_lengths)
            std_gap = np.std(gap_lengths)

            anomalies = []
            for gap in gaps:
                if std_gap > 0:
                    z_score = (gap['gap_hours'] - mean_gap) / std_gap
                    if z_score > 2.5:  # Unusual long gap
                        confidence = min(z_score / 5, 1.0)

                        anomalies.append({
                            'anomaly_type': 'unusual_communication_gap',
                            'confidence': confidence,
                            'description': f'Unusually long communication gap of {gap["gap_hours"]:.1f} hours from {gap["start_time"]} to {gap["end_time"]}',
                            'gap_hours': gap['gap_hours'],
                            'z_score': z_score,
                            'start_time': gap['start_time'],
                            'end_time': gap['end_time']
                        })

            return anomalies

        except Exception as e:
            logger.error(f"Error detecting unusual gaps: {e}")
            return []

    def _detect_centrality_anomalies(self, network_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Detect anomalies based on centrality measures"""
        try:
            if len(network_data) < 3:
                return []

            # Calculate degree centrality
            degrees = [record.get('communication_frequency', 0) for record in network_data]
            mean_degree = np.mean(degrees)
            std_degree = np.std(degrees)

            anomalies = []
            for i, record in enumerate(network_data):
                degree = record.get('communication_frequency', 0)

                if std_degree > 0:
                    z_score = (degree - mean_degree) / std_degree

                    if abs(z_score) > 2.0:
                        confidence = min(abs(z_score) / 4, 1.0)
                        anomaly_type = 'high_centrality_node' if z_score > 0 else 'low_centrality_node'

                        anomalies.append({
                            'anomaly_type': anomaly_type,
                            'confidence': confidence,
                            'description': f'{record.get("phone_number", "Unknown")} shows {anomaly_type.replace("_", " ")} (degree: {degree}, z-score: {z_score:.2f})',
                            'phone_number': record.get('phone_number'),
                            'degree': degree,
                            'z_score': z_score,
                            'expected_degree': mean_degree
                        })

            return anomalies

        except Exception as e:
            logger.error(f"Error detecting centrality anomalies: {e}")
            return []

    def _detect_cluster_anomalies(self, network_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Detect clustering coefficient anomalies"""
        try:
            # Simplified clustering analysis
            contact_diversities = [record.get('unique_contacts', 1) for record in network_data]

            if len(contact_diversities) < 3:
                return []

            mean_diversity = np.mean(contact_diversities)
            std_diversity = np.std(contact_diversities)

            anomalies = []
            for record in network_data:
                diversity = record.get('unique_contacts', 1)

                if std_diversity > 0:
                    z_score = (diversity - mean_diversity) / std_diversity

                    if abs(z_score) > 2.5:
                        confidence = min(abs(z_score) / 5, 1.0)
                        direction = "high" if z_score > 0 else "low"

                        anomalies.append({
                            'anomaly_type': f'{direction}_clustering_node',
                            'confidence': confidence,
                            'description': f'{record.get("phone_number", "Unknown")} has unusually {direction} contact diversity ({diversity} unique contacts)',
                            'phone_number': record.get('phone_number'),
                            'contact_diversity': diversity,
                            'z_score': z_score
                        })

            return anomalies

        except Exception as e:
            logger.error(f"Error detecting cluster anomalies: {e}")
            return []

    def _detect_bridge_anomalies(self, network_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Detect bridge nodes that connect different clusters"""
        try:
            # Simplified bridge detection based on frequency vs diversity ratio
            anomalies = []

            for record in network_data:
                frequency = record.get('communication_frequency', 0)
                diversity = record.get('unique_contacts', 1)

                if frequency > 0 and diversity > 0:
                    bridge_score = frequency / diversity

                    # Compare to expected ratio (simplified)
                    expected_ratio = 5.0  # Assumption
                    ratio_deviation = abs(bridge_score - expected_ratio) / expected_ratio

                    if ratio_deviation > 1.5:  # 150% deviation
                        confidence = min(ratio_deviation / 3, 1.0)
                        direction = "high" if bridge_score > expected_ratio else "low"

                        anomalies.append({
                            'anomaly_type': f'{direction}_frequency_diversity_ratio',
                            'confidence': confidence,
                            'description': f'{record.get("phone_number", "Unknown")} shows unusual communication pattern (freq/diversity ratio: {bridge_score:.2f})',
                            'phone_number': record.get('phone_number'),
                            'frequency': frequency,
                            'diversity': diversity,
                            'bridge_score': bridge_score
                        })

            return anomalies

        except Exception as e:
            logger.error(f"Error detecting bridge anomalies: {e}")
            return []

    def _detect_isolation_anomalies(self, network_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Detect isolated nodes with very few connections"""
        try:
            anomalies = []

            for record in network_data:
                frequency = record.get('communication_frequency', 0)
                diversity = record.get('unique_contacts', 1)

                # Consider isolated if very low activity
                if frequency < 3 and diversity == 1:
                    confidence = 0.7  # Moderate confidence for isolation

                    anomalies.append({
                        'anomaly_type': 'isolated_node',
                        'confidence': confidence,
                        'description': f'{record.get("phone_number", "Unknown")} appears isolated with minimal communication activity',
                        'phone_number': record.get('phone_number'),
                        'frequency': frequency,
                        'diversity': diversity,
                        'isolation_score': 1.0 / (frequency + diversity + 1)  # Higher score = more isolated
                    })

            return anomalies

        except Exception as e:
            logger.error(f"Error detecting isolation anomalies: {e}")
            return []

    def _classify_hourly_anomaly(self, hour: int, z_score: float) -> str:
        """Classify the type of hourly anomaly"""
        if hour >= 22 or hour <= 5:
            return 'late_night_activity_spike' if z_score > 0 else 'late_night_activity_dip'
        elif hour >= 6 and hour <= 9:
            return 'morning_activity_spike' if z_score > 0 else 'morning_activity_dip'
        elif hour >= 17 and hour <= 21:
            return 'evening_activity_spike' if z_score > 0 else 'evening_activity_dip'
        else:
            return 'business_hours_activity_spike' if z_score > 0 else 'business_hours_activity_dip'

    def _deduplicate_temporal_anomalies(self, anomalies: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate or overlapping temporal anomalies"""
        try:
            # Group by time windows and keep highest confidence
            time_windows = {}

            for anomaly in anomalies:
                # Create time window key
                if 'hour' in anomaly:
                    window_key = f"hour_{anomaly['hour']}"
                elif 'day' in anomaly:
                    window_key = f"day_{anomaly['day']}"
                else:
                    window_key = f"general_{len(time_windows)}"

                if window_key not in time_windows or time_windows[window_key]['confidence'] < anomaly['confidence']:
                    time_windows[window_key] = anomaly

            return list(time_windows.values())

        except Exception as e:
            logger.error(f"Error deduplicating temporal anomalies: {e}")
            return anomalies

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
