import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN, KMeans, AgglomerativeClustering
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from scipy import stats
from scipy.signal import find_peaks, correlate
import networkx as nx
from typing import Dict, List, Any, Optional, Tuple, Union
import logging
import asyncio
import re
from datetime import datetime, timedelta
from collections import Counter, defaultdict
import itertools

logger = logging.getLogger(__name__)

class PatternRecognitionEngine:
    """
    Advanced pattern recognition system for forensic data analysis
    """

    def __init__(self):
        self.patterns = {}
        self.clusters = {}
        self.sequences = {}
        self.graph_patterns = {}

    async def discover_patterns(self, data: List[Dict[str, Any]],
                              pattern_types: List[str] = None) -> Dict[str, Any]:
        """
        Discover patterns in forensic data using multiple algorithms

        Args:
            data: Forensic data to analyze
            pattern_types: Types of patterns to discover

        Returns:
            Discovered patterns and analysis
        """
        if pattern_types is None:
            pattern_types = ['temporal', 'spatial', 'frequency', 'behavioral', 'network', 'content']

        results = {
            'patterns_discovered': {},
            'total_patterns': 0,
            'analysis_summary': {},
            'confidence_scores': {}
        }

        try:
            # Discover each type of pattern
            for pattern_type in pattern_types:
                if pattern_type == 'temporal':
                    temporal_patterns = await self._discover_temporal_patterns(data)
                    results['patterns_discovered']['temporal'] = temporal_patterns
                    results['total_patterns'] += len(temporal_patterns)

                elif pattern_type == 'spatial':
                    spatial_patterns = await self._discover_spatial_patterns(data)
                    results['patterns_discovered']['spatial'] = spatial_patterns
                    results['total_patterns'] += len(spatial_patterns)

                elif pattern_type == 'frequency':
                    frequency_patterns = await self._discover_frequency_patterns(data)
                    results['patterns_discovered']['frequency'] = frequency_patterns
                    results['total_patterns'] += len(frequency_patterns)

                elif pattern_type == 'behavioral':
                    behavioral_patterns = await self._discover_behavioral_patterns(data)
                    results['patterns_discovered']['behavioral'] = behavioral_patterns
                    results['total_patterns'] += len(behavioral_patterns)

                elif pattern_type == 'network':
                    network_patterns = await self._discover_network_patterns(data)
                    results['patterns_discovered']['network'] = network_patterns
                    results['total_patterns'] += len(network_patterns)

                elif pattern_type == 'content':
                    content_patterns = await self._discover_content_patterns(data)
                    results['patterns_discovered']['content'] = content_patterns
                    results['total_patterns'] += len(content_patterns)

            # Generate analysis summary
            results['analysis_summary'] = self._generate_pattern_summary(results['patterns_discovered'])

            # Calculate confidence scores
            results['confidence_scores'] = self._calculate_pattern_confidence(results['patterns_discovered'])

            return results

        except Exception as e:
            logger.error(f"Error in pattern discovery: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    async def _discover_temporal_patterns(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Discover temporal patterns in the data"""
        patterns = []

        try:
            # Extract timestamps
            timestamps = []
            for item in data:
                if 'timestamp' in item:
                    try:
                        dt = pd.to_datetime(item['timestamp'])
                        timestamps.append(dt)
                    except:
                        continue

            if len(timestamps) < 10:
                return patterns

            # Convert to pandas for analysis
            df = pd.DataFrame({'timestamp': timestamps})
            df = df.sort_values('timestamp')

            # Hourly patterns
            df['hour'] = df['timestamp'].dt.hour
            hourly_counts = df.groupby('hour').size()

            # Detect peak hours
            peaks, _ = find_peaks(hourly_counts.values, height=np.mean(hourly_counts))
            for peak in peaks:
                hour = hourly_counts.index[peak]
                count = hourly_counts.iloc[peak]
                confidence = min(count / np.mean(hourly_counts) - 1, 1.0)

                patterns.append({
                    'pattern_type': 'temporal_hourly_peak',
                    'description': f'Communication peak at {hour:02d}:00',
                    'confidence': float(confidence),
                    'hour': int(hour),
                    'count': int(count),
                    'pattern_data': hourly_counts.to_dict()
                })

            # Daily patterns
            df['day'] = df['timestamp'].dt.day_name()
            daily_counts = df.groupby('day').size()

            # Detect unusual days
            mean_daily = np.mean(daily_counts)
            for day, count in daily_counts.items():
                z_score = (count - mean_daily) / np.std(daily_counts) if np.std(daily_counts) > 0 else 0
                if abs(z_score) > 1.5:
                    confidence = min(abs(z_score) / 3, 1.0)
                    direction = "high" if z_score > 0 else "low"

                    patterns.append({
                        'pattern_type': f'temporal_daily_{direction}',
                        'description': f'Unusually {direction} activity on {day}',
                        'confidence': float(confidence),
                        'day': day,
                        'count': int(count),
                        'z_score': float(z_score)
                    })

            # Time gap patterns
            df = df.sort_values('timestamp')
            time_diffs = df['timestamp'].diff().dt.total_seconds() / 3600  # hours

            # Find unusual gaps
            mean_gap = np.mean(time_diffs.dropna())
            std_gap = np.std(time_diffs.dropna())

            if std_gap > 0:
                for i, gap in enumerate(time_diffs):
                    if pd.notna(gap):
                        z_score = (gap - mean_gap) / std_gap
                        if z_score > 2.0:
                            confidence = min(z_score / 5, 1.0)

                            patterns.append({
                                'pattern_type': 'temporal_unusual_gap',
                                'description': f'Unusual time gap of {gap:.1f} hours',
                                'confidence': float(confidence),
                                'gap_hours': float(gap),
                                'z_score': float(z_score),
                                'position': i
                            })

        except Exception as e:
            logger.error(f"Error discovering temporal patterns: {e}")

        return patterns

    async def _discover_spatial_patterns(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Discover spatial/geographic patterns"""
        patterns = []

        try:
            # Extract location data
            locations = []
            for item in data:
                if 'location' in item or 'coordinates' in item:
                    loc = item.get('location') or item.get('coordinates')
                    if loc:
                        locations.append(loc)

            if len(locations) < 5:
                return patterns

            # Convert to coordinates if needed
            coordinates = []
            for loc in locations:
                if isinstance(loc, dict) and 'lat' in loc and 'lng' in loc:
                    coordinates.append([loc['lat'], loc['lng']])
                elif isinstance(loc, list) and len(loc) == 2:
                    coordinates.append(loc)

            if len(coordinates) < 5:
                return patterns

            # Clustering analysis
            coords_array = np.array(coordinates)
            scaler = StandardScaler()
            coords_scaled = scaler.fit_transform(coords_array)

            # Try different clustering approaches
            for n_clusters in range(2, min(6, len(coordinates))):
                kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
                cluster_labels = kmeans.fit_predict(coords_scaled)

                # Evaluate clustering quality
                if len(set(cluster_labels)) > 1:
                    silhouette = silhouette_score(coords_scaled, cluster_labels)

                    if silhouette > 0.3:  # Good clustering
                        # Analyze clusters
                        for cluster_id in range(n_clusters):
                            cluster_points = coords_array[cluster_labels == cluster_id]
                            if len(cluster_points) > 0:
                                centroid = np.mean(cluster_points, axis=0)
                                cluster_size = len(cluster_points)

                                patterns.append({
                                    'pattern_type': 'spatial_cluster',
                                    'description': f'Geographic cluster with {cluster_size} points',
                                    'confidence': float(min(silhouette, 1.0)),
                                    'cluster_id': cluster_id,
                                    'cluster_size': cluster_size,
                                    'centroid': centroid.tolist(),
                                    'silhouette_score': float(silhouette)
                                })

        except Exception as e:
            logger.error(f"Error discovering spatial patterns: {e}")

        return patterns

    async def _discover_frequency_patterns(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Discover frequency-based patterns"""
        patterns = []

        try:
            # Analyze frequency distributions
            frequencies = [item.get('frequency', 1) for item in data if 'frequency' in item]

            if len(frequencies) < 10:
                return patterns

            # Statistical analysis
            freq_array = np.array(frequencies)

            # Distribution analysis
            mean_freq = np.mean(freq_array)
            std_freq = np.std(freq_array)
            skewness = stats.skew(freq_array)
            kurtosis = stats.kurtosis(freq_array)

            # Detect outliers
            z_scores = np.abs(stats.zscore(freq_array))
            outlier_indices = np.where(z_scores > 3)[0]

            for idx in outlier_indices:
                confidence = min(z_scores[idx] / 5, 1.0)
                patterns.append({
                    'pattern_type': 'frequency_outlier',
                    'description': f'Frequency outlier: {freq_array[idx]} (z-score: {z_scores[idx]:.2f})',
                    'confidence': float(confidence),
                    'frequency': float(freq_array[idx]),
                    'z_score': float(z_scores[idx]),
                    'index': int(idx)
                })

            # Detect patterns in frequency changes
            if len(freq_array) > 5:
                # Calculate frequency changes
                freq_changes = np.diff(freq_array)

                # Find significant changes
                change_threshold = np.std(freq_changes) * 2
                significant_changes = np.where(np.abs(freq_changes) > change_threshold)[0]

                for idx in significant_changes:
                    change = freq_changes[idx]
                    confidence = min(abs(change) / (mean_freq * 0.5), 1.0)

                    patterns.append({
                        'pattern_type': 'frequency_change',
                        'description': f'Significant frequency change: {change:+.1f}',
                        'confidence': float(confidence),
                        'change': float(change),
                        'position': int(idx),
                        'before': float(freq_array[idx]),
                        'after': float(freq_array[idx + 1])
                    })

            # Overall distribution pattern
            if abs(skewness) > 0.5:
                direction = "right-skewed" if skewness > 0 else "left-skewed"
                confidence = min(abs(skewness), 1.0)

                patterns.append({
                    'pattern_type': 'frequency_distribution',
                    'description': f'Frequency distribution is {direction} (skewness: {skewness:.2f})',
                    'confidence': float(confidence),
                    'skewness': float(skewness),
                    'kurtosis': float(kurtosis),
                    'mean': float(mean_freq),
                    'std': float(std_freq)
                })

        except Exception as e:
            logger.error(f"Error discovering frequency patterns: {e}")

        return patterns

    async def _discover_behavioral_patterns(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Discover behavioral patterns"""
        patterns = []

        try:
            # Analyze behavioral sequences
            behaviors = []

            for item in data:
                behavior = {
                    'type': item.get('type', 'unknown'),
                    'user': item.get('user_id', item.get('phone_number', 'unknown')),
                    'timestamp': item.get('timestamp'),
                    'action': item.get('action', item.get('type', 'unknown'))
                }
                behaviors.append(behavior)

            if len(behaviors) < 10:
                return patterns

            # Sequence analysis
            df = pd.DataFrame(behaviors)
            df = df.sort_values('timestamp')

            # User behavior patterns
            user_patterns = df.groupby('user').agg({
                'action': list,
                'timestamp': ['count', 'min', 'max']
            }).reset_index()

            for _, row in user_patterns.iterrows():
                user = row['user']
                actions = row['action']['list']
                action_count = row['timestamp']['count']

                if action_count >= 5:
                    # Analyze action sequences
                    action_sequence = actions[:20]  # First 20 actions
                    most_common_action = Counter(action_sequence).most_common(1)[0]

                    if most_common_action[1] / len(action_sequence) > 0.7:  # 70% same action
                        confidence = min(most_common_action[1] / len(action_sequence), 1.0)

                        patterns.append({
                            'pattern_type': 'behavioral_repetitive',
                            'description': f'User {user} shows repetitive {most_common_action[0]} behavior',
                            'confidence': float(confidence),
                            'user': user,
                            'dominant_action': most_common_action[0],
                            'action_count': most_common_action[1],
                            'total_actions': len(action_sequence)
                        })

            # Time-based behavioral patterns
            df['hour'] = pd.to_datetime(df['timestamp']).dt.hour
            hourly_behaviors = df.groupby(['user', 'hour']).size().reset_index(name='count')

            for user in hourly_behaviors['user'].unique():
                user_data = hourly_behaviors[hourly_behaviors['user'] == user]
                max_hour = user_data.loc[user_data['count'].idxmax()]

                if max_hour['count'] > np.mean(user_data['count']) * 2:
                    confidence = min(max_hour['count'] / np.mean(user_data['count']) - 1, 1.0)

                    patterns.append({
                        'pattern_type': 'behavioral_time_preference',
                        'description': f'User {user} prefers activity at hour {max_hour["hour"]:02d}',
                        'confidence': float(confidence),
                        'user': user,
                        'preferred_hour': int(max_hour['hour']),
                        'activity_count': int(max_hour['count'])
                    })

        except Exception as e:
            logger.error(f"Error discovering behavioral patterns: {e}")

        return patterns

    async def _discover_network_patterns(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Discover network relationship patterns"""
        patterns = []

        try:
            # Build communication network
            G = nx.Graph()

            for item in data:
                sender = item.get('sender', item.get('from'))
                receiver = item.get('receiver', item.get('to'))

                if sender and receiver:
                    G.add_edge(sender, receiver)

            if G.number_of_nodes() < 5:
                return patterns

            # Network analysis
            # Centrality measures
            degree_centrality = nx.degree_centrality(G)
            betweenness_centrality = nx.betweenness_centrality(G)
            closeness_centrality = nx.closeness_centrality(G)

            # Find high-centrality nodes
            for node in G.nodes():
                degree_cent = degree_centrality[node]
                between_cent = betweenness_centrality[node]

                if degree_cent > np.mean(list(degree_centrality.values())) * 1.5:
                    confidence = min(degree_cent / np.mean(list(degree_centrality.values())), 1.0)

                    patterns.append({
                        'pattern_type': 'network_high_degree',
                        'description': f'Node {node} has high degree centrality ({degree_cent:.3f})',
                        'confidence': float(confidence),
                        'node': node,
                        'degree_centrality': float(degree_cent),
                        'betweenness_centrality': float(between_cent)
                    })

                if between_cent > np.mean(list(betweenness_centrality.values())) * 2:
                    confidence = min(between_cent / np.mean(list(betweenness_centrality.values())), 1.0)

                    patterns.append({
                        'pattern_type': 'network_bridge',
                        'description': f'Node {node} acts as network bridge ({between_cent:.3f})',
                        'confidence': float(confidence),
                        'node': node,
                        'degree_centrality': float(degree_cent),
                        'betweenness_centrality': float(between_cent)
                    })

            # Community detection (simplified)
            if G.number_of_edges() > 10:
                # Use connected components as communities
                components = list(nx.connected_components(G))

                if len(components) > 1:
                    for i, component in enumerate(components):
                        if len(component) >= 3:
                            patterns.append({
                                'pattern_type': 'network_community',
                                'description': f'Network community with {len(component)} nodes',
                                'confidence': 0.8,  # High confidence for detected communities
                                'community_id': i,
                                'community_size': len(component),
                                'nodes': list(component)
                            })

        except Exception as e:
            logger.error(f"Error discovering network patterns: {e}")

        return patterns

    async def _discover_content_patterns(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Discover content-based patterns"""
        patterns = []

        try:
            # Extract text content
            texts = []
            for item in data:
                content = item.get('content', item.get('message', ''))
                if content and len(str(content)) > 10:
                    texts.append(str(content).lower())

            if len(texts) < 5:
                return patterns

            # Keyword frequency analysis
            all_words = []
            for text in texts:
                words = re.findall(r'\b\w+\b', text)
                all_words.extend(words)

            word_freq = Counter(all_words)

            # Remove common stop words
            stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall'}
            filtered_words = {word: count for word, count in word_freq.items() if word not in stop_words and len(word) > 2}

            # Find frequent keywords
            total_words = sum(filtered_words.values())
            for word, count in filtered_words.items():
                frequency = count / total_words
                if frequency > 0.01:  # More than 1% of all words
                    confidence = min(frequency * 100, 1.0)

                    patterns.append({
                        'pattern_type': 'content_keyword',
                        'description': f'Frequent keyword: "{word}" ({count} occurrences)',
                        'confidence': float(confidence),
                        'keyword': word,
                        'count': count,
                        'frequency': float(frequency)
                    })

            # Pattern matching for common phrases
            common_phrases = [
                'call me', 'text me', 'meet me', 'see you', 'talk to you',
                'let me know', 'thank you', 'sorry', 'please', 'help'
            ]

            for phrase in common_phrases:
                phrase_count = sum(1 for text in texts if phrase in text)
                if phrase_count > len(texts) * 0.1:  # More than 10% of texts
                    confidence = min(phrase_count / len(texts), 1.0)

                    patterns.append({
                        'pattern_type': 'content_phrase',
                        'description': f'Common phrase: "{phrase}" ({phrase_count} occurrences)',
                        'confidence': float(confidence),
                        'phrase': phrase,
                        'count': phrase_count,
                        'percentage': float(phrase_count / len(texts) * 100)
                    })

        except Exception as e:
            logger.error(f"Error discovering content patterns: {e}")

        return patterns

    def _generate_pattern_summary(self, patterns: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        """Generate summary of discovered patterns"""
        summary = {
            'total_patterns_by_type': {},
            'average_confidence_by_type': {},
            'most_confident_patterns': [],
            'pattern_distribution': {}
        }

        all_patterns = []
        for pattern_type, pattern_list in patterns.items():
            summary['total_patterns_by_type'][pattern_type] = len(pattern_list)

            if pattern_list:
                confidences = [p['confidence'] for p in pattern_list]
                summary['average_confidence_by_type'][pattern_type] = float(np.mean(confidences))

                all_patterns.extend(pattern_list)

        # Most confident patterns
        if all_patterns:
            sorted_patterns = sorted(all_patterns, key=lambda x: x['confidence'], reverse=True)
            summary['most_confident_patterns'] = sorted_patterns[:5]

        # Pattern distribution
        total_patterns = sum(summary['total_patterns_by_type'].values())
        for pattern_type, count in summary['total_patterns_by_type'].items():
            summary['pattern_distribution'][pattern_type] = float(count / total_patterns) if total_patterns > 0 else 0

        return summary

    def _calculate_pattern_confidence(self, patterns: Dict[str, List[Dict[str, Any]]]) -> Dict[str, float]:
        """Calculate overall confidence scores for pattern types"""
        confidence_scores = {}

        for pattern_type, pattern_list in patterns.items():
            if pattern_list:
                # Weight by confidence and number of patterns
                total_weighted_confidence = sum(p['confidence'] * (1 + len(pattern_list) * 0.1) for p in pattern_list)
                total_weight = sum(1 + len(pattern_list) * 0.1 for p in pattern_list)

                confidence_scores[pattern_type] = float(total_weighted_confidence / total_weight)
            else:
                confidence_scores[pattern_type] = 0.0

        return confidence_scores

    async def analyze_pattern_correlations(self, patterns: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        """Analyze correlations between different pattern types"""
        try:
            correlation_matrix = {}
            pattern_types = list(patterns.keys())

            for i, type1 in enumerate(pattern_types):
                correlation_matrix[type1] = {}

                for type2 in pattern_types:
                    if type1 == type2:
                        correlation_matrix[type1][type2] = 1.0
                    else:
                        # Calculate correlation based on confidence scores
                        conf1 = [p['confidence'] for p in patterns[type1]]
                        conf2 = [p['confidence'] for p in patterns[type2]]

                        if conf1 and conf2:
                            correlation = np.corrcoef(conf1[:len(conf2)], conf2[:len(conf1)])[0, 1]
                            correlation_matrix[type1][type2] = float(correlation) if not np.isnan(correlation) else 0.0
                        else:
                            correlation_matrix[type1][type2] = 0.0

            return {
                'correlation_matrix': correlation_matrix,
                'highly_correlated_pairs': self._find_highly_correlated_pairs(correlation_matrix)
            }

        except Exception as e:
            logger.error(f"Error analyzing pattern correlations: {e}")
            return {'error': str(e)}

    def _find_highly_correlated_pairs(self, correlation_matrix: Dict[str, Dict[str, float]]) -> List[Dict[str, Any]]:
        """Find highly correlated pattern pairs"""
        pairs = []

        for type1 in correlation_matrix:
            for type2 in correlation_matrix[type1]:
                if type1 != type2:
                    correlation = correlation_matrix[type1][type2]
                    if abs(correlation) > 0.7:  # Strong correlation
                        pairs.append({
                            'pattern1': type1,
                            'pattern2': type2,
                            'correlation': correlation,
                            'strength': 'strong' if abs(correlation) > 0.8 else 'moderate'
                        })

        return sorted(pairs, key=lambda x: abs(x['correlation']), reverse=True)


# Global instance
pattern_recognition_engine = PatternRecognitionEngine()
