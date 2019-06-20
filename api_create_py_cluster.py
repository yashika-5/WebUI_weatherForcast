import requests
import base64

DOMAIN = 'dbc-b60127c0-14a8.cloud.databricks.com'
TOKEN = b'dapicaf4c848bd9483912879e50bb88e94f5'

response = requests.post(
  'https://%s/api/2.0/clusters/create' % (DOMAIN),
  headers={'Authorization': b"Basic " + base64.standard_b64encode(b"token:" + TOKEN)},
  json={
  "new_cluster": {
    "spark_version": "5.2.x-scala2.11",
    "node_type_id": "r3.xlarge",
      "spark_env_vars": {
      "PYSPARK_PYTHON": "/databricks/python3/bin/python3",
      }
    }
  }
)

if response.status_code == 200:
  print(response.json()['cluster_id'])
else:
  print("Error launching cluster: %s: %s" % (response.json()["error_code"], response.json()["message"]))