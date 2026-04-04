"""
Anomaly Detection Service using ML algorithms
Detects unusual patterns in forensic data

Integrates pretrained deep-learning models:
  - XGBoost multi-class attack classifier (41 features)
  - Universal DNN binary anomaly detector (23 features + category embedding)
  - LSTM Autoencoder for sequence-level anomaly detection (18 features)
"""

import numpy as np
import torch
from typing import List, Dict, Any, Tuple
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import DBSCAN
import pandas as pd
from datetime import datetime, timedelta
import logging

from .unified_model_loader import load_all_models, ModelBundle

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

        # Load pretrained deep-learning model suite
        try:
            self.model_bundle: ModelBundle = load_all_models()
            logger.info(
                f"Advanced model bundle loaded — errors: {len(self.model_bundle.load_errors)}"
            )
        except Exception as e:
            logger.error(f"Failed to load advanced model bundle: {e}")
            self.model_bundle = ModelBundle()  # empty fallback

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

                        # Identify context for the spike (most active contact in this hour)
                        hour_data = [r for r in temporal_data if pd.to_datetime(r.get('timestamp')).hour == hour]
                        entities = [r.get('contact_name') or r.get('phone_number') or r.get('type') for r in hour_data]
                        main_entity = max(set(entities), key=entities.count) if entities else 'various'

                        anomalies.append({
                            'anomaly_type': anomaly_type,
                            'confidence': confidence,
                            'description': f'Unusual activity spike at {hour:02d}:00 featuring high engagement with {main_entity} ({count} communications, {z_score:.2f}σ from mean)',
                            'hour': hour,
                            'count': count,
                            'z_score': z_score,
                            'expected_count': mean_count,
                            'time_window': f"{hour:02d}:00-{hour+1:02d}:00",
                            'record': hour_data[:5] # Sample of communications for evidence
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

                        # Identify the primary entity in the burst
                        burst_window = sorted_data[max(0, i-window_size):min(len(sorted_data), i+window_size)]
                        entities = [r.get('contact_name') or r.get('phone_number') or r.get('type') for r in burst_window]
                        main_entity = max(set(entities), key=entities.count) if entities else 'unknown'

                        anomalies.append({
                            'anomaly_type': 'communication_burst',
                            'confidence': confidence,
                            'description': f'Sudden communication burst detected around {sorted_data[i].get("timestamp")}. Cluster involves intensified activity with {main_entity}.',
                            'burst_score': burst_score,
                            'window_size': window_size,
                            'local_density': len(local_window) / (2 * window_size),
                            'record': burst_window # Full burst history for evidence
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
                            'records_after': len(sorted_data) - i,
                            'prev_record': sorted_data[i-1],
                            'next_record': sorted_data[i]
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

                        prev = gap['prev_record']
                        curr = gap['next_record']
                        
                        # Use Name > Phone > Type
                        p_entity = prev.get('contact_name') or prev.get('phone_number') or prev.get('type', 'Unknown')
                        n_entity = curr.get('contact_name') or curr.get('phone_number') or curr.get('type', 'Unknown')
                        
                        description = (
                            f"Unusually long communication gap of {gap['gap_hours']:.1f} hours detected. "
                            f"Investigation found communication halted after contact with '{p_entity}' "
                            f"and only resumed {gap['gap_hours']:.1f} hours later with '{n_entity}'."
                        )

                        anomalies.append({
                            'anomaly_type': 'unusual_communication_gap',
                            'confidence': confidence,
                            'description': description,
                            'gap_hours': gap['gap_hours'],
                            'z_score': z_score,
                            'start_time': gap['start_time'],
                            'end_time': gap['end_time'],
                            'record': {
                                'preceding_communication': prev.get('record'),
                                'resuming_communication': curr.get('record')
                            }
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

    # ─────────────────────────────────────────────────────────────────
    #  Advanced (deep-learning) anomaly detection on communication logs
    # ─────────────────────────────────────────────────────────────────

    def _build_xgb_features(self, record: Dict[str, Any]) -> np.ndarray:
        """
        Map a UFDR communication record to the 41-feature vector expected by
        the XGBoost scaler. Missing network features are initialized to their 
        training median (center_) to ensure they remain neutral.
        """
        if self.model_bundle.xgb_scaler is not None and hasattr(self.model_bundle.xgb_scaler, 'center_'):
            feats = self.model_bundle.xgb_scaler.center_.copy()
        else:
            feats = np.zeros(41, dtype=np.float64)

        feats[0] = float(record.get('duration', 0))            # duration
        feats[4] = float(record.get('frequency', 1))            # src_bytes proxy
        feats[5] = float(record.get('unique_contacts', 1))      # dst_bytes proxy

        ts = record.get('timestamp', '')
        if ts:
            try:
                dt = pd.to_datetime(ts)
                feats[1] = dt.hour / 24.0
                feats[2] = dt.weekday() / 7.0
                feats[3] = dt.month / 12.0
            except Exception:
                pass

        phone = record.get('phone_number', '')
        if phone.startswith('+') and not phone.startswith('+91'):
            feats[6] = 1.0

        feats[22] = float(record.get('communication_frequency', record.get('frequency', 1)))
        feats[23] = float(record.get('unique_contacts', 1))

        return feats

    def _build_dnn_features(self, record: Dict[str, Any]) -> Tuple[np.ndarray, int]:
        """
        Map a UFDR communication record to the 23 continuous features 
        expected by the DNN scaler, setting missing fields to the training median.
        """
        if self.model_bundle.dnn_scaler is not None and hasattr(self.model_bundle.dnn_scaler, 'center_'):
            feats = self.model_bundle.dnn_scaler.center_.copy()
        else:
            feats = np.zeros(23, dtype=np.float64)

        feats[0] = float(record.get('duration', 0))
        feats[1] = float(record.get('frequency', 1))
        feats[2] = float(record.get('unique_contacts', 1))

        ts = record.get('timestamp', '')
        if ts:
            try:
                dt = pd.to_datetime(ts)
                feats[3] = dt.hour
                feats[4] = dt.minute
                feats[5] = dt.weekday()
                feats[6] = dt.month
            except Exception:
                pass

        phone = record.get('phone_number', '')
        feats[7] = 1.0 if (phone.startswith('+') and not phone.startswith('+91')) else 0.0
        feats[8] = float(record.get('communication_frequency', record.get('frequency', 1)))

        source_type = str(record.get('source_type', '')).lower()
        domain_map = {'network': 4, 'iot': 2, 'mobile': 3, 'cloud': 0, 'cyber': 1, 'crime': 5}
        cat_idx = 3  # default = mobile
        for key, idx in domain_map.items():
            if key in source_type:
                cat_idx = idx
                break

        return feats, cat_idx

    def _build_lstm_features(self, record: Dict[str, Any]) -> np.ndarray:
        """
        Map a UFDR communication record to the 18-feature vector expected by
        the LSTM Autoencoder scaler.
        """
        if self.model_bundle.lstm_scaler is not None and hasattr(self.model_bundle.lstm_scaler, 'center_'):
            feats = self.model_bundle.lstm_scaler.center_.copy()
        else:
            feats = np.zeros(18, dtype=np.float64)

        feats[0] = float(record.get('duration', 0))
        feats[1] = float(record.get('frequency', 1))

        ts = record.get('timestamp', '')
        if ts:
            try:
                dt = pd.to_datetime(ts)
                feats[2] = dt.hour / 24.0
                feats[3] = dt.minute / 60.0
                feats[4] = dt.weekday() / 7.0
                feats[5] = dt.month / 12.0
            except Exception:
                pass

        phone = record.get('phone_number', '')
        feats[6] = 1.0 if (phone.startswith('+') and not phone.startswith('+91')) else 0.0
        feats[7] = float(record.get('unique_contacts', 1))
        feats[8] = float(record.get('communication_frequency', record.get('frequency', 1)))

        return feats

    # ── runners ───────────────────────────────────────────────────────

    def _run_xgb_detection(self, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Run XGBoost attack classifier on communication records."""
        bundle = self.model_bundle
        if bundle.xgb_model is None or bundle.xgb_scaler is None:
            return []

        try:
            raw = np.array([self._build_xgb_features(r) for r in records])
            scaled = bundle.xgb_scaler.transform(raw)
            preds = bundle.xgb_model.predict(scaled)
            probs = bundle.xgb_model.predict_proba(scaled)

            anomalies = []
            for i, (pred, prob_row) in enumerate(zip(preds, probs)):
                # Decode label
                label = str(pred)
                if bundle.attack_label_encoder is not None:
                    try:
                        label = bundle.attack_label_encoder.inverse_transform([pred])[0]
                    except Exception:
                        pass

                if label == 'Normal':
                    continue

                confidence = float(np.max(prob_row))
                threshold = bundle.inference_thresholds.get(label, 0.25)

                if confidence >= threshold:
                    rec = records[i]
                    entity = rec.get('contact_name') or rec.get('phone_number') or 'Unknown'
                    ts = rec.get('timestamp', 'unknown time')
                    src = rec.get('source_type', 'communication')
                    dur = rec.get('duration', 0)
                    content_hint = (rec.get('content') or '')[:80]
                    content_snippet = ('Content snippet: "' + content_hint + '"') if content_hint else ''

                    # Build forensic explanation per attack category
                    explanations = {
                        'Probe': (
                            f"Probing behaviour detected in {src} with '{entity}' at {ts}. "
                            f"The communication pattern resembles reconnaissance — "
                            f"short duration ({dur}s), unusual timing, and contact diversity "
                            f"suggest the subject may be scanning or profiling contacts. "
                            f"{content_snippet}"
                        ),
                        'DoS': (
                            f"Denial-of-Service-like flooding pattern detected involving '{entity}' at {ts}. "
                            f"An unusually high volume of {src} activity in a short window suggests "
                            f"automated or rapid-fire messaging, which may indicate harassment, "
                            f"spam activity, or an attempt to overwhelm the recipient. "
                            f"Duration: {dur}s."
                        ),
                        'R2L': (
                            f"Remote-to-Local intrusion pattern found in {src} with '{entity}' at {ts}. "
                            f"The combination of foreign contact origin, message timing, and "
                            f"communication frequency is consistent with external actors attempting "
                            f"to establish unauthorized access or social engineering. "
                            f"{content_snippet}"
                        ),
                        'U2R': (
                            f"User-to-Root privilege escalation pattern in {src} with '{entity}' at {ts}. "
                            f"Communication characteristics suggest an insider threat — "
                            f"the subject's activity deviates from their normal baseline, "
                            f"potentially indicating attempts to gain elevated access or "
                            f"extract sensitive information. Duration: {dur}s."
                        ),
                    }

                    description = explanations.get(label, (
                        f"Suspicious {label} pattern detected in {src} with '{entity}' at {ts}. "
                        f"The AI classifier flagged this record because the combination of "
                        f"timing, frequency, duration ({dur}s), and contact pattern deviates "
                        f"significantly from normal communication behaviour. "
                        f"{content_snippet}"
                    ))

                    anomalies.append({
                        'record': rec,
                        'anomaly_type': f'xgb_attack_{label.lower()}',
                        'attack_category': label,
                        'confidence': confidence,
                        'description': description,
                        'model': 'xgboost',
                    })

            anomalies.sort(key=lambda x: x['confidence'], reverse=True)
            logger.info(f"XGBoost detected {len(anomalies)} attack anomalies")
            return anomalies[:15]

        except Exception as e:
            logger.error(f"XGBoost detection error: {e}")
            return []

    def _run_dnn_detection(self, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Run Universal DNN binary anomaly detector on communication records."""
        bundle = self.model_bundle
        if bundle.dnn_model is None or bundle.dnn_scaler is None:
            return []

        try:
            cont_list, cat_list = [], []
            for r in records:
                c, cat = self._build_dnn_features(r)
                cont_list.append(c)
                cat_list.append(cat)

            cont_arr = np.array(cont_list)
            cont_scaled = bundle.dnn_scaler.transform(cont_arr)

            x_cont = torch.tensor(cont_scaled, dtype=torch.float32)
            x_cat = torch.tensor(cat_list, dtype=torch.long)

            with torch.no_grad():
                logits = bundle.dnn_model(x_cont, x_cat).squeeze(-1)  # (N,)
                probs = torch.sigmoid(logits).numpy()

            anomalies = []
            for i, prob in enumerate(probs):
                if prob > 0.5:
                    rec = records[i]
                    entity = rec.get('contact_name') or rec.get('phone_number') or 'Unknown'
                    ts = rec.get('timestamp', 'unknown time')
                    src = rec.get('source_type', 'communication')
                    dur = rec.get('duration', 0)
                    content_hint = (rec.get('content') or '')[:80]
                    phone = rec.get('phone_number', '')
                    is_foreign = phone.startswith('+') and not phone.startswith('+91')

                    # Build reason based on which features likely drove the score
                    reasons = []
                    if is_foreign:
                        reasons.append(f"foreign contact origin ({phone})")
                    if dur > 300:
                        reasons.append(f"extended call duration ({dur}s)")
                    elif dur == 0:
                        reasons.append("zero-duration contact (possible missed/rejected)")
                    try:
                        hour = pd.to_datetime(ts).hour
                        if hour >= 22 or hour <= 5:
                            reasons.append(f"late-night timing ({hour:02d}:00)")
                    except Exception:
                        pass

                    reason_str = ', '.join(reasons) if reasons else 'multi-factor behavioural deviation'

                    content_snippet_dnn = ('Content: "' + content_hint + '"') if content_hint else ''

                    description = (
                        f"Deep Neural Network flagged {src} with '{entity}' at {ts} "
                        f"as behaviourally anomalous (score {float(prob):.1%}). "
                        f"Key contributing factors: {reason_str}. "
                        f"This record's feature profile deviates significantly from "
                        f"the learned normal communication baseline. "
                        f"{content_snippet_dnn}"
                    )

                    anomalies.append({
                        'record': rec,
                        'anomaly_type': 'dnn_anomaly',
                        'confidence': float(prob),
                        'description': description,
                        'model': 'universal_dnn',
                    })

            anomalies.sort(key=lambda x: x['confidence'], reverse=True)
            logger.info(f"DNN detected {len(anomalies)} anomalies")
            return anomalies[:15]

        except Exception as e:
            logger.error(f"DNN detection error: {e}")
            return []

    def _run_lstm_ae_detection(self, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Run LSTM Autoencoder on communication records.

        Records are grouped into fixed-length subsequences; reconstruction
        error above the learned threshold flags the window as anomalous.
        """
        bundle = self.model_bundle
        if bundle.lstm_model is None or bundle.lstm_scaler is None:
            return []

        try:
            raw = np.array([self._build_lstm_features(r) for r in records])
            scaled = bundle.lstm_scaler.transform(raw)

            # Create sliding windows of length 10
            seq_len = 10
            if len(scaled) < seq_len:
                return []

            windows, window_indices = [], []
            for start in range(0, len(scaled) - seq_len + 1, seq_len):
                windows.append(scaled[start:start + seq_len])
                window_indices.append((start, start + seq_len))

            if not windows:
                return []

            x = torch.tensor(np.array(windows), dtype=torch.float32)  # (W, 10, 18)

            with torch.no_grad():
                reconstructed = bundle.lstm_model(x)  # (W, 10, 18)

            mse_per_window = torch.mean((x - reconstructed) ** 2, dim=(1, 2)).numpy()

            anomalies = []
            for idx, (mse, (start, end)) in enumerate(zip(mse_per_window, window_indices)):
                if mse > bundle.lstm_ae_threshold:
                    confidence = min(float(mse / (bundle.lstm_ae_threshold * 2)), 1.0)
                    # Extract context from the window's records
                    window_records = records[start:end]
                    entities_in_window = list(set(
                        r.get('contact_name') or r.get('phone_number') or 'Unknown'
                        for r in window_records
                    ))
                    types_in_window = list(set(
                        r.get('source_type', 'unknown') for r in window_records
                    ))
                    time_start = window_records[0].get('timestamp', '?') if window_records else '?'
                    time_end = window_records[-1].get('timestamp', '?') if window_records else '?'
                    error_ratio = float(mse) / bundle.lstm_ae_threshold

                    severity = 'mildly' if error_ratio < 1.5 else 'significantly' if error_ratio < 3 else 'critically'

                    description = (
                        f"LSTM Autoencoder found a {severity} anomalous communication sequence "
                        f"spanning {time_start} to {time_end} ({end - start} records). "
                        f"The temporal pattern of {', '.join(types_in_window)} activity involving "
                        f"{', '.join(entities_in_window[:3])}"
                        f"{f' and {len(entities_in_window) - 3} others' if len(entities_in_window) > 3 else ''} "
                        f"deviates from learned behavioural norms (reconstruction error "
                        f"{float(mse):.2f}, {error_ratio:.1f}x above threshold). "
                        f"This suggests an unusual shift in communication rhythm, contact mix, "
                        f"or activity timing during this period."
                    )

                    anomalies.append({
                        'anomaly_type': 'lstm_sequence_anomaly',
                        'confidence': confidence,
                        'description': description,
                        'reconstruction_error': float(mse),
                        'threshold': float(bundle.lstm_ae_threshold),
                        'window_start': start,
                        'window_end': end,
                        'record': window_records,
                        'model': 'lstm_autoencoder',
                    })

            anomalies.sort(key=lambda x: x['confidence'], reverse=True)
            logger.info(f"LSTM-AE detected {len(anomalies)} sequence anomalies")
            return anomalies[:10]

        except Exception as e:
            logger.error(f"LSTM-AE detection error: {e}")
            return []

    def detect_advanced_anomalies(
        self, communication_data: List[Dict[str, Any]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Run all three advanced models on the communication logs.

        Returns:
            Dictionary with keys xgb_anomalies, dnn_anomalies, lstm_anomalies
        """
        results: Dict[str, List[Dict[str, Any]]] = {
            'xgb_anomalies': [],
            'dnn_anomalies': [],
            'lstm_anomalies': [],
        }

        if not self.model_bundle.is_loaded or not communication_data:
            return results

        results['xgb_anomalies'] = self._run_xgb_detection(communication_data)
        results['dnn_anomalies'] = self._run_dnn_detection(communication_data)
        results['lstm_anomalies'] = self._run_lstm_ae_detection(communication_data)

        return results

    # ─────────────────────────────────────────────────────────────────
    #  Comprehensive detection (original + advanced)
    # ─────────────────────────────────────────────────────────────────

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
            'advanced_anomalies': {
                'xgb_anomalies': [],
                'dnn_anomalies': [],
                'lstm_anomalies': [],
            },
            'summary': {}
        }

        try:
            # Communication anomalies (Isolation Forest)
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

            # ── Advanced deep-learning detection on ALL communication logs ──
            if 'communications' in case_data and case_data['communications']:
                results['advanced_anomalies'] = self.detect_advanced_anomalies(
                    case_data['communications']
                )

            # ── Generate combined summary ────────────────────────────────
            classic_anomalies = (
                results['communication_anomalies']
                + results['temporal_anomalies']
                + results['network_anomalies']
            )
            advanced_anomalies = (
                results['advanced_anomalies'].get('xgb_anomalies', [])
                + results['advanced_anomalies'].get('dnn_anomalies', [])
                + results['advanced_anomalies'].get('lstm_anomalies', [])
            )
            all_anomalies = classic_anomalies + advanced_anomalies
            total_anomalies = len(all_anomalies)

            results['summary'] = {
                'total_anomalies': total_anomalies,
                'classic_anomalies': len(classic_anomalies),
                'advanced_anomalies': len(advanced_anomalies),
                'high_confidence_count': sum(
                    1 for a in all_anomalies if a.get('confidence', 0) > 0.7
                ),
                'anomaly_types': list(set(
                    a.get('anomaly_type', 'unknown') for a in all_anomalies
                )),
                'models_used': list(set(
                    a.get('model', 'classic') for a in all_anomalies
                )),
                'risk_level': self._calculate_overall_risk_v2(all_anomalies),
            }

            logger.info(
                f"Anomaly detection completed: {total_anomalies} anomalies "
                f"(classic={len(classic_anomalies)}, advanced={len(advanced_anomalies)})"
            )
            return results

        except Exception as e:
            logger.error(f"Error in comprehensive anomaly detection: {e}")
            return results

    def _calculate_overall_risk(self, results: Dict[str, List[Dict[str, Any]]]) -> str:
        """Calculate overall risk level based on anomalies detected (legacy)"""
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

    @staticmethod
    def _calculate_overall_risk_v2(all_anomalies: List[Dict[str, Any]]) -> str:
        """Calculate overall risk from the unified anomaly list."""
        total = len(all_anomalies)
        high_conf = sum(1 for a in all_anomalies if a.get('confidence', 0) > 0.7)
        has_attack = any(
            a.get('anomaly_type', '').startswith('xgb_attack_') for a in all_anomalies
        )

        if has_attack or high_conf >= 5 or total >= 12:
            return 'critical'
        elif high_conf >= 3 or total >= 8:
            return 'high'
        elif high_conf >= 1 or total >= 4:
            return 'medium'
        elif total >= 1:
            return 'low'
        else:
            return 'none'


# Global instance
anomaly_detector = AnomalyDetector()
