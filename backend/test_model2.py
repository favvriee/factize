
import torch
import torch.nn as nn
from transformers import AutoModel

class ClassifierHead(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc1 = nn.Linear(384, 256)
        self.norm1 = nn.BatchNorm1d(256)
        self.fc2 = nn.Linear(256, 128)
        self.norm2 = nn.BatchNorm1d(128)
        self.fc_out = nn.Linear(128, 2)
        
    def forward(self, x):
        x = torch.relu(self.norm1(self.fc1(x)))
        x = torch.relu(self.norm2(self.fc2(x)))
        return self.fc_out(x)

class CvTImageDetector(nn.Module):
    def __init__(self):
        super().__init__()
        self.cvt = AutoModel.from_pretrained('microsoft/cvt-13', trust_remote_code=True)
        self.classifier = ClassifierHead()
        
    def forward(self, x):
        outputs = self.cvt(x)
        # What if they didn't do mean?
        # Let's see if the keys match!
        pass

m = CvTImageDetector()
weights = torch.load('app/models/model_epoch_24.pth', map_location='cpu')['model_state_dict']
missing, unexpected = m.load_state_dict(weights, strict=False)
print('Missing:', [k for k in missing if 'classifier' in k])
print('Unexpected:', [k for k in unexpected if 'classifier' in k])

