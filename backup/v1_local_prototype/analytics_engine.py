import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
import collections
import time

class AnalyticsEngine:
    def __init__(self, window_size=2, slide_step=1):
        self.window_size = window_size
        self.slide_step = slide_step
        self.packet_buffer = collections.deque()
        self.model = IsolationForest(contamination=0.01, random_state=42)
        self.is_trained = False
        
    def add_packet(self, packet_dict):
        self.packet_buffer.append(packet_dict)
        
    def clean_old_packets(self, current_time):
        while self.packet_buffer and self.packet_buffer[0]['timestamp'] < (current_time - self.window_size):
            self.packet_buffer.popleft()

    def extract_features(self, current_time):
        self.clean_old_packets(current_time)
        
        if not self.packet_buffer:
            return None
            
        df = pd.DataFrame(list(self.packet_buffer))
        
        packet_count = len(df)
        total_bytes = df['length'].sum()
        packet_rate = packet_count / self.window_size
        byte_rate = total_bytes / self.window_size
        
        ip_counts = df['src_ip'].value_counts()
        probabilities = ip_counts / packet_count
        entropy = float(-np.sum(probabilities * np.log2(probabilities)))
        
        feature_vector = {
            "packet_count": packet_count,
            "total_bytes": total_bytes,
            "packet_rate": packet_rate,
            "byte_rate": byte_rate,
            "entropy": entropy
        }
        return feature_vector

    def train_baseline(self, normal_traffic_dataset):
        df = pd.DataFrame(normal_traffic_dataset)
        self.model.fit(df)
        self.is_trained = True
        print("MODEL INFO: Baseline training complete.")

    def check_anomaly(self, feature_vector):
        if not self.is_trained:
            return 1
            
        df = pd.DataFrame([feature_vector])
        prediction = self.model.predict(df)[0]
        return int(prediction)