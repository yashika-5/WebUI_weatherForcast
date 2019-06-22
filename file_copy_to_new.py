import sys

param = sys.argv[1]

with open ("/dbfs/FileStore/tables/file3.txt", "r") as f:
    f.seek(0)
    data1 = f.read()
with open("/dbfs/FileStore/tables/file2.txt", "r") as f:
    f.seek(0)
    data2 = f.read()
with open("/dbfs/FileStore/tables/op3.txt", "w+") as op:
    op.write(data1+data2+param)   

