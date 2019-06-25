
# coding: utf-8

# In[1]:





# # Implementation of Decision Tree through Spark Execution Engine (Implemented as notebook on Databricks Community Edition)

# ## Overview
# 
#  [DBFS](https://docs.databricks.com/user-guide/dbfs-databricks-file-system.html) is a Databricks File System that allows you to store data for querying inside of Databricks. This notebook assumes that you have a file already inside of DBFS that you would like to read from.
#  
# I have performed the following in Spark:
# 1. Generate a categorical variable from a numeric variable
# 2. Aggregate the features into one single column
# 3. Randomly split the data into training and test sets
# 4. Create a decision tree classifier to predict days with low humidity.

# In[2]:

import sys
#uid = sys.argv[1]
from pyspark.sql import SQLContext
from pyspark.sql import DataFrameNaFunctions



# In[3]:

import urllib
Access_Key = "------------"
Secret_Key = "------------"
ENCODED_SECRET_KEY = urllib.parse.quote(Secret_Key, "")
AWS_BUCKET_NAME = "wf-users-data"
MOUNT_NAME = "my-data"

#dbutils.fs.mount("s3n://%s:%s@%s" % (Access_Key, ENCODED_SECRET_KEY, AWS_BUCKET_NAME), "/mnt/%s" % MOUNT_NAME)


from pyspark.ml import Pipeline
from pyspark.ml.classification import DecisionTreeClassifier
from pyspark.ml.feature import Binarizer
from pyspark.ml.feature import VectorAssembler,StringIndexer,VectorIndexer
import pandas as pd

# In[4]:

from pyspark.sql import DataFrameNaFunctions
from pyspark import SparkConf
from pyspark import SparkContext
#conf = SparkConf().setAppName("pyspark")
#sc = SparkContext(conf=conf)
sqlContext = SQLContext(sc)
df = sqlContext.read.load('/mnt/my-data/u1/data.csv',format = 'com.databricks.spark.csv',header='true',inferSchema='true')
#dfresult_pdf = df.select("*").toPandas()1 = pd.read_csv('/dbfs/FileStore/tables/data.csv',header='infer'
df1 = df.select("*").toPandas()

# In[5]:


#df.columns


# In[6]:


featureColumns = ['air_pressure_9am','air_temp_9am','avg_wind_direction_9am','avg_wind_speed_9am',
        'max_wind_direction_9am','max_wind_speed_9am','rain_accumulation_9am',
        'rain_duration_9am']


# Dropping unused and missing data.

# In[7]:


df = df.drop('number')


# In[8]:


df = df.na.drop()


# In[9]:


#df.count(),len(df.columns)


# Creating categorical variable: Let create a categorical variable to denote if the humidity is not low. If the value is less than 25%, then we want the categorical value to be 0, otherwise the categorical value should be 1. We can create this categorical variable as a column in a DataFrame using Binarizer

# In[10]:


binarizer = Binarizer(threshold=24.99999,inputCol="relative_humidity_3pm",outputCol="label")
binarizedDF = binarizer.transform(df)


# In[11]:


#binarizedDF.describe()


# # Creating target variable named label

# The threshold argument specifies the threshold value for the variable, inputCol is the input column to read, and outputCol is the name of the new categorical column. The second line applies the Binarizer and creates a new DataFrame with the categorical column. We can look at the first four values in the new DataFrame:

# In[12]:


#binarizedDF.select("relative_humidity_3pm","label").show(4)


# The first row's humidity value is greater than 25% and the label is 1. The other humidity values are less than 25% and have labels equal to 0.

# # Aggregate features : 

#  Let's aggregate the features we will use to make predictions into a single column:
#  The inputCols argument specifies our list of column names we defined earlier, and outputCol is the name of the new column. The second line creates a new DataFrame with the aggregated features in a column.
# 

# In[13]:


assembler = VectorAssembler(inputCols=featureColumns,outputCol="features")
assembled = assembler.transform(binarizedDF)


# In[14]:


#assembled.printSchema()


# # Split training and test data : 

# We can split the data by calling randomSplit():
# The first argument is how many parts to split the data into and the approximate size of each. This specifies two sets of 80% and 20%. Normally, the seed should not be specified, but we use a specific value here so that everyone will get the same decision tree. 

# In[15]:


(trainingData,testData) = assembled.randomSplit([0.8,0.2],seed = 13234)


# In[16]:


#trainingData.count(),testData.count()


# # Create and train decision tree : 

# The labelCol argument is the column we are trying to predict, featuresCol specifies the aggregated features column, maxDepth is stopping criterion for tree induction based on maximum depth of tree, minInstancesPerNode is stopping criterion for tree induction based on minimum number of samples in a node, and impurity is the impurity measure used to split nodes.
# 
# We can create a model by training the decision tree. This is done by executing it in a Pipeline:

# In[17]:


dt = DecisionTreeClassifier(labelCol="label",featuresCol="features",maxDepth=5,minInstancesPerNode=20,impurity="gini")


# In[18]:


pipeline = Pipeline(stages=[dt])
model = pipeline.fit(trainingData)


# Let's make predictions using our test data set:

# In[19]:


predictions = model.transform(testData)


# Looking at the first ten rows in the prediction, we can see the prediction matches the input:

# In[20]:


#predictions.select("prediction","label").show(10)


#  Save predictions to CSV. Finally, let's save the predictions to a CSV file. 
# Let's save only the prediction and label columns to a CSV file:

# In[21]:


predictions.select("prediction","label").write.save(path = '/mnt/my-data/u1/predictions.csv',format="com.databricks.spark.csv",header='true')


# In[2]:


from pyspark.ml.evaluation import MulticlassClassificationEvaluator
from pyspark.mllib.evaluation import MulticlassMetrics
df.show(10)


# In[3]:


predictions = sqlContext.read.load('/mnt/my-data/u1/predictions.csv',format = 'com.databricks.spark.csv',header='true',inferSchema='true')


# In[4]:


evaluator = MulticlassClassificationEvaluator(labelCol="label",predictionCol="prediction",metricName="accuracy")


# In[5]:


accuracy = evaluator.evaluate(predictions)


# In[6]:


predictions.show(10)


# In[7]:


print("Accuracy = %g " % (accuracy))


# In[8]:


predictions.rdd.take(2)


# In[9]:


predictions.rdd.map(tuple).take(2)


# In[10]:


metrics = MulticlassMetrics(predictions.rdd.map(tuple))


# In[11]:


metrics.confusionMatrix().toArray().transpose()


# In[12]:


print ("Error = %g " % (1.0 - accuracy))


# In[13]:


print ("Accuracy = %.2g" % (accuracy * 100))


# In[14]:


metrics.confusionMatrix().toArray()


# In[15]:


df1.corr


# In[16]:


import seaborn as sns
svm=display(sns.heatmap(df1.corr(),annot=True).figure)


# In[17]:


import matplotlib.pyplot as plt
p = plt.savefig('svm_conf.jpg', dpi=400)  # jpg image of heat map


# In[18]:


display(p)

