
import torch
import torch.nn as nn
from transformers import AutoModel
import sys

class CvTImageDetector(nn.Module):
    def __init__(self):
        super(CvTImageDetector, self).__init__()
        self.cvt = AutoModel.from_pretrained('microsoft/cvt-13', trust_remote_code=True)
        embed_dim_final = 384
        self.classifier = nn.Linear(embed_dim_final, 2)
    def forward(self, x):
        outputs = self.cvt(x)
        print('last_hidden_state shape:', outputs.last_hidden_state.shape)
        pooled_output = outputs.last_hidden_state.mean(dim=[-2, -1])
        print('pooled_output shape:', pooled_output.shape)
        return self.classifier(pooled_output)

m = CvTImageDetector()
try:
    print('Testing original forward pass')
    m(torch.randn(1, 3, 224, 224))
except Exception as e:
    print('ERROR:', e)

