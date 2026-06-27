import torch
import torch.nn as nn
from transformers import AutoModel
import collections

class CustomClassifier(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc1 = nn.Linear(384, 256)
        self.norm1 = nn.BatchNorm1d(256)
        self.fc2 = nn.Linear(256, 128)
        self.norm2 = nn.BatchNorm1d(128)
        self.fc_out = nn.Linear(128, 2)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(0.5)

    def forward(self, x):
        x = self.fc1(x)
        x = self.norm1(x)
        x = self.relu(x)
        x = self.dropout(x)
        
        x = self.fc2(x)
        x = self.norm2(x)
        x = self.relu(x)
        x = self.dropout(x)
        
        x = self.fc_out(x)
        return x

class CvTImageDetector(nn.Module):
    def __init__(self):
        super(CvTImageDetector, self).__init__()
        self.cvt = AutoModel.from_pretrained("microsoft/cvt-13", trust_remote_code=True)
        self.layernorm = nn.LayerNorm(384)
        self.classifier = CustomClassifier()

    def forward(self, x):
        outputs = self.cvt(x)
        sequence_output = outputs.last_hidden_state
        batch_size, num_channels, height, width = sequence_output.shape
        sequence_output = sequence_output.view(batch_size, num_channels, height * width).permute(0, 2, 1)
        sequence_output = self.layernorm(sequence_output)
        sequence_output_mean = sequence_output.mean(dim=1)
        return self.classifier(sequence_output_mean)

model = CvTImageDetector()
ckpt = torch.load('app/models/model_epoch_24.pth', map_location='cpu')
res = model.load_state_dict(ckpt['model_state_dict'], strict=True)
print(res)
