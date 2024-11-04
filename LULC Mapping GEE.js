var vis_lan_7_sr= {
   bands: ['SR_B3','SR_B2','SR_B1'],
  min: 0,
  max: 0.3,
  gamma: 1.4, 
}

var vis_lan_8_sr = 
  {
  bands: ['B7','B6','B4'],
  min: 0,
  max: 3000,
  gamma: 1.4
      }
      
var lan_7_sr= ee.ImageCollection("LANDSAT/LE07/C02/T1_L2").filterMetadata('CLOUD_COVER','less_than',10).filterBounds(Municipality)      

// Applies scaling factors TO Landsat_7.
function applyScaleFactors(image) {
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBand = image.select('ST_B6').multiply(0.00341802).add(149.0);
  return image.addBands(opticalBands, null, true)
              .addBands(thermalBand, null, true);
}
// Applies scaling factors TO Landsat_8.
function applyScaleFactors1(image) {
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);
  return image.addBands(opticalBands, null, true)
              .addBands(thermalBands, null, true);
}

var Landsat_7 = lan_7_sr.map(applyScaleFactors)
var Img_2010_gap = Landsat_7.filterDate('2010-10-01','2010-12-28').first()   

//Gap_filling

function Gap_fill(img)
{
  var Img_fill = img.focal_mean(1.5,'square','pixels',20)
  var img_corr = Img_fill.blend(img)
  return img_corr
  }
var Img_2010 = Gap_fill(Img_2010_gap)

function maskL8sr(image) {
  // Bits 3 and 5 are cloud shadow and cloud, respectively.
  var cloudShadowBitMask = (1 << 3);
  var cloudsBitMask = (1 << 5);
  // Get the pixel QA band.
  var qa = image.select('pixel_qa');
  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
                 .and(qa.bitwiseAnd(cloudsBitMask).eq(0));
  return image.updateMask(mask);
}

var Img_2020 =  lan8_sr.filterBounds(Municipality)
                 .filterDate("2020-04-01","2020-04-15").filterMetadata("CLOUD_COVER", "less_than", 30).sort("CLOUD_COVER",true)
                 .map(maskL8sr).first()
var Img_2015 =  lan8_sr.filterBounds(Municipality)
                 .filterDate("2015-10-01","2015-10-12").filterMetadata("CLOUD_COVER", "less_than", 30).sort("CLOUD_COVER",true)
                 .map(maskL8sr).first()

var date_2020 = ee.Date(Img_2020.get('system:time_start'));
print('Timestamp:', date_2020)

var date_2015 = ee.Date(Img_2015.get('system:time_start'));
print('Timestamp:', date_2015)

var date_2010 = ee.Date(Img_2010_gap.get('system:time_start'));
print('Timestamp:', date_2010)

var dataset = [Img_2010,Img_2015,Img_2020]

var dataset2 = []
var classified_data = []
var i

for(i=0; i<=2; i++)
{
  var Img = dataset[i]
  var Clipped_Img = Img.clip(Municipality)
  dataset2.push(Clipped_Img)
}


// *********************CLASSIFICATION OF LULC*************************

//Merge classes for classification 2010
var classNames_2010 = Forest_2010.merge(Agriculture_2010)
                      .merge(Built_up_2010)
                      .merge(Barren_Land_2010)
                      
//Merge classes for classification 2015
var classNames_2015 = Forest_2015.merge(Agriculture_2015)
                      .merge(Built_up_2015)
                      .merge(Barren_Land_2015)
                      
//Merge classes for classification 2020                    
var classNames_2020 = Forest_2020.merge(Agriculture_2020)
                      .merge(Built_up_2020)
                      .merge(Barren_Land_2020)

var classes = [classNames_2010, classNames_2015, classNames_2020]

// splitting feature collection as training and validation collection
var training_data = []
var validation_data = []

function split_data(arg1)
  {
  arg1= arg1.randomColumn()
var split = 0.7;  // Roughly 70% training, 30% testing.

var train_arg1 = arg1.filter(ee.Filter.lt('random', split));
var valid_arg1 = arg1.filter(ee.Filter.gte('random', split));
  training_data.push(train_arg1)
  validation_data.push(valid_arg1)
  }

//For splitting ROI  
for (i=0; i<=2; i++)
{
  split_data(classes[i])
}

var classified_data =[]
var bands_lan_7 =  ['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7']
var bands_lan_8 = ['B2', 'B3', 'B4', 'B5','B6' ,'B7']

//*************** Classification of Images ***************** 
for (i=0; i<=2; i++)
{
    if(i===0)
    {
      var training = dataset2[i].select(bands_lan_7).sampleRegions({
      collection:training_data[i],
      properties:['LULC'],
      scale:30})
    var classifier_2010 = ee.Classifier.smileCart().train(training,'LULC', bands_lan_7)
    var classified_2010 = dataset2[i].select(bands_lan_7).classify(classifier_2010)
    classified_data.push(classified_2010)
    }
 
    else if(i==1)
    {
      var training = dataset2[i].select(bands_lan_8).sampleRegions({
      collection:training_data[i],
      properties:['LULC'],
      scale:30})
    var classifier_2015 = ee.Classifier.smileCart().train(training,'LULC', bands_lan_8)
    var classified_2015 = dataset2[i].select(bands_lan_8).classify(classifier_2015)
    classified_data.push(classified_2015)
    }
    if(i==2)
    { 
      var training = dataset2[i].select(bands_lan_8).sampleRegions({
      collection:training_data[i],
      properties:['LULC'],
      scale:30})
    var classifier_2020 = ee.Classifier.smileCart().train(training,'LULC', bands_lan_8)
    var classified_2020 = dataset2[i].select(bands_lan_8).classify(classifier_2020)
    classified_data.push(classified_2020)
    }
}

//************** Export Classified Image****************
for(i=0; i<=2; i++)
{ 
 if(i===0){
 Map.addLayer(classified_data[i],{min: 0, max: 3, palette: ['green', 'yellow', 'red','brown']},'classification_2010')
 Map.addLayer(dataset2[i], vis_lan_7_sr , 'lansat7 SR 2010')  
  Export.image.toDrive({
      image: classified_data[i],
      description: 'LULC',
      fileNamePrefix: 2010,
      region: Municipality,
      scale:30});
 }
  else if(i===1)
  {
 Map.addLayer(classified_data[i],{min: 4, max: 7, palette: ['green', 'yellow', 'red','brown']},
 'classification_2015')
  Map.addLayer(dataset2[i], vis_lan_8_sr, 'lansat8 SR 2015')
   Export.image.toDrive({
      image: classified_data[i],
      description: 'LULC',
      fileNamePrefix: 2015,
      region: Municipality,
      scale:30});
  }
  else if(i===2)
  {
  Map.addLayer(classified_data[i],{min: 8, max: 11, palette: ['green', 'yellow', 'red','brown']},
  'classification_2020')
 Map.addLayer(dataset2[i], vis_lan_8_sr, 'lansat8 SR 2020')
   Export.image.toDrive({
      image: classified_data[i],
      description: 'LULC',
      fileNamePrefix: 2020,
      region: Municipality,
      scale:30});
  }
}

//*************** VALIDATE RESULT AND EXPORT ERROR MATRIX ****************
for (i=0;i<=2;i++)
{
  print(validation_data[i].size())
  if (i===0)
  {
    var validation_2010 = classified_2010.sampleRegions({
    collection: validation_data[i],
    properties: ['LULC'],
    scale: 30})
  var testAccuracy = validation_2010.errorMatrix('LULC', 'classification');
//Print the error matrix to the console
  print('Validation error matrix: ', testAccuracy);
//Print the overall accuracy to the console
  print('Validation overall accuracy: ', testAccuracy.accuracy());
  
// Export the FeatureCollection.
  var exportAccuracy = ee.Feature(null, {matrix: testAccuracy.array()})
  Export.table.toDrive({
  collection: ee.FeatureCollection(exportAccuracy),
  description: 'exportAccuracy',
  fileNamePrefix: '2010',
  fileFormat: 'CSV'
    })
  }
  else if(i===1)
    {
    var validation_2015 = classified_2015.sampleRegions({
    collection: validation_data[i],
    properties: ['LULC'],
    scale: 30})
    
  var testAccuracy = validation_2015.errorMatrix('LULC', 'classification');
//Print the error matrix to the console
  print('Validation error matrix: ', testAccuracy);
//Print the overall accuracy to the console
  print('Validation overall accuracy: ', testAccuracy.accuracy());
  // Export the FeatureCollection.
  var exportAccuracy = ee.Feature(null, {matrix: testAccuracy.array()})
  Export.table.toDrive({
  collection: ee.FeatureCollection(exportAccuracy),
  description: 'exportAccuracy',
  fileNamePrefix: '2015',
  fileFormat: 'CSV'
    })
  }
  else if(i===2)
  {
    var validation_2020 = classified_2020.sampleRegions({
    collection: validation_data[i],
    properties: ['LULC'],
    scale: 30})
  var testAccuracy = validation_2020.errorMatrix('LULC', 'classification');
//Print the error matrix to the console
  print('Validation error matrix: ', testAccuracy);
//Print the overall accuracy to the console
  print('Validation overall accuracy: ', testAccuracy.accuracy());
  // Export the FeatureCollection.
  var exportAccuracy = ee.Feature(null, {matrix: testAccuracy.array()})
  Export.table.toDrive({
  collection: ee.FeatureCollection(exportAccuracy),
  description: 'exportAccuracy',
  fileNamePrefix: '2020',
  fileFormat: 'CSV'
    })
  }
}
//************ DISPLAY MUNICIPAL BOUNDARY *************
var empty = ee.Image().byte();
var outline = empty.paint({
  featureCollection: Municipality,
  color: 1,
  width: 0.2
});

// Display Municipal Boundary
Map.addLayer(outline, {palette: 'purple'}, 'Suryabinayak Bounary')
//Center Map with Municipality
Map.centerObject(Municipality,13);

for (i=0; i<=2; i++)
{
   var area_cl_1= ee.Image.pixelArea().divide(1e6).addBands(classified_data[i])
  var areas = area_cl_1.reduceRegion({
    reducer: ee.Reducer.sum().group({
      groupField: 1,
      groupName: 'class',
    }),
    geometry: Municipality.geometry(),
    scale: 30,
    maxPixels: 1e10
    }); 
  print(areas)
}
