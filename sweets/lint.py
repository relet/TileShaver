#!/usr/bin/env python26

import requests
import sys

file = sys.argv[1]

data = open(file, "r").read()
r = requests.post("http://geojsonlint.com/validate", data=data)

print r.content
