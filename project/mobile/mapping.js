'use strict';
const mapValues = {
    "os":"os_name",
    "camera_resolution" :"primary_camera_resolution",
    "bluetooth" : "bluetooth_type",
    "touch screen" : "touch_screen",
    "removable battery" :"removable_battery",
    "brand" : "brand",
    "music player" : "music_player",
    "ram" :"ram_memory",
    "number flipkart ratings" : "no_of_ratings_flipkart",
    "fm" : "FM",
    "weight" : "weight",
    "gps" : "gps_type",
    "cores" : "no_of_cores",
    "sim type" : "sim_type",
    "sim size" : "sim_size",
    "video player" : "video_formats",
    "flash" : "flash_type",
    "display type" : "display_type",
    "front_camera_resolution" :"front_camera_resolution",
    "model name" :"model_name",
    "battery type" :"battery_type",
    "battery score":"battery_score",
    "announced date": "announced_date",
    "wifi" :"wifi_type",
    "expandable memory":"expandable_memory",
    "screen size" :"screen_size",
    "primary flash" :"flash_type",
    "processor":"processor_type",
    "audio jack":"audio_jack",
    "average rating in amazon":"average_rating_amazon",
    "average rating flipkart":"average_rating_flipkart",
    "handset color":"available_colors",
    "USB type":"usb_type",
    "primary camera resolution":"primary_camera_resolution",
    "battery_capacity":"battery_capacity",
    "sensors":"sensors",
    "video":"hd_recording",
    "rating":"average_rating",
    "primary camera features":"primary_camera_features",
    "height":"phone_height",
    "in the box":"in_the_box",
    "display resolution":"display_resolution",
    "thickness": "thickness",
    "width":"phone_width",
    "number amazon ratings":"no_of_ratings_amazon",
    "secondary camera features":"front_camera_resolution",
    "processor frequency":"processor_frequency",
    "internal memory":"internal_memory",
    "pros":"pros",
    "cons":"cons",
    "gpu rank":"gpu_rank",
    "pixel density":"screen_pixel_density",
    "micro sd slot" :"micro_sd_slot",
    "talk time": "talk_time",
    "stand by time":"stand_by_time",
    "aperture":"aperture",
    "flipkart rating":"average_rating_flipkart",
    "network support" : "network_support",
    "amazon rating":"average_rating_amazon",
    "gpu" :"gpu",
    "audio format": "audio_formats",
    "screen protection":"screen_protection",
    "water proof":"water_proof_rate",
    "price":"price",
    "popular":"Popular",
    "verdict":"verdict_review",
    "display review":"display_review",
    "battery review":"battery_review",
    "camera review": "camera_review",
    'camera' : "primary_camera_resolution",
    'battery' :"battery_capacity",
    'display': "display_type",
    'usb type' : 'usb_type',
    "video format" : "video_formats",
    "mobile color" : "available_colors",
    "video resolution" : "video_resolution",
    "version" : "version_name",
    "version name" : "version_name"
};
function isDbKeyExists(key){
    return mapValues.hasOwnProperty(key);
}
function getDbKey(key){
    return mapValues[key];
}
//sort orders for displaying mobiles
const specSortMappings = {
    // Features
    'camera' : {"camera_score":"desc","primary_camera_resolution":"desc","price":"asc"},
    'battery' : {"talk_time":"desc","battery_score":"desc","battery_capacity":"desc","price":"asc"},
    'performance' : {"performance_score":"desc","processor_rank":"asc","price":"asc"},
    'display': {"display_score":"desc","price":"asc"},
    'phonelist_camera' : {"camera_score":"desc","primary_camera_resolution":"desc","price":"asc"},
    'memory':
    {"_script" : {
        "type" : "number",
        "script" : "doc['internal_memory'].value + doc['expandable_memory'].value",
        "order" : "desc"
        }
    },
    'audio' :{'overall_score':'desc'},
    'video' :{'overall_score':'desc'},
    'network':{'overall_score':'desc'},
    'phonelist_battery' :{'talk_time':'desc'},
    'brand' :{'brand_rank':'asc','overall_score':'desc'},
    'capacity':{"battery_capacity":'desc','battery_score':'desc',"price":"asc"},
    "rating" : {'average_rating':'desc','performance_score':'desc',"price":"asc"},
    "gpu":{"gpu_rank":'asc','performance_score':'desc',"price":"asc"},
    "camera_resolution": {'primary_camera_resolution':'desc',"camera_score":'desc',"price":"asc"},
    "front_camera_resolution":{"front_camera_resolution":'desc','camera_score':'desc',"price":"asc"},
    "phonelist_front_camera":{"front_camera_resolution":'desc','camera_score':'desc',"price":"asc"},
    "internal memory":{'internal_memory':'desc',"price":"asc"},
    "ram": {'ram_memory':'desc',"price":"asc"},
    "processor":{"processor_rank":'asc','performance_score':'desc',"price":"asc"},
    "phonelist_perform":{"processor_rank":'asc','performance_score':'desc',"price":"asc"},
    "thickness":{'thickness':'asc','overall_score':'desc',"price":'asc'},
    "height":{'phone_width':'asc',"price":'asc'},
    "weight":{'weight':'asc','thickness':'asc',"price":'asc'},
    "number fipkart ratings":{'no_of_ratings_flipkart':'desc','overall_score':'desc','price':'asc'},
    "average rating amazon":{'no_of_ratings_amazon':'desc','overall_score':'desc','price':'asc'},
    "screen protection" :{ "overall_score":"desc", 'price' : "asc" },
    "phonelist_memory" :
    {"_script" : {
            "type" : "number",
            "script" : "doc['internal_memory'].value + doc['expandable_memory'].value",
            "order" : "desc"
        }
    },
    "phonelist_autofocus" :{camera_score:"desc"},
    "phonelist_videos" :{camera_score: "desc"},
    "popular" :{"overall_score":"desc"},
    "overall" :{"overall_score":"desc"},
    "price" : {"price": "asc"},
    "processor_type" :{'processor_rank':"asc"},
    "adult female":{"front_camera_resolution":"desc",'thickness':'asc',"primary_camera_resolution":"desc"},
    "adult male":{'performance_score':'desc','battery_score':'desc'},
    'kids':{"overall_score":"desc"},
    "os" :{"overall_score":"desc","version":"desc",'price':"asc"},
    'selfie':{"front_camera_resolution":"desc",'overall_score':'asc'},
    "slim":{'thickness':'asc','overall_score':'asc'},
    'daytime':{}
};
function isSpecSortKeyExists(key){
    return (key in specSortMappings);
}
function specsSortValue(key){
    return specSortMappings[key];
}
const useCaseQuestions = {
    "camera" : [
        "primary_camera", "secondary_camera"
    ],
    "display" : [
        "display_size", "display_type"
    ],
    "battery" : [
        "battery_comsumption","battery_usage"
    ],
    "performance" : [
        "performance_games", "performance_app"
    ],
    "memory" : [
        "memory_internal", "memory_external"
    ]
};
function isUseCaseQuestionExists(key)
{
    return useCaseQuestions.hasOwnProperty(key);
}
function getUseCaseQuestion(key)
{
    return useCaseQuestions[key];
}
const mapUnits ={
    "internal_memory" : "GB",
    "expandable_memory" : "GB",
    "ram_memory" :"GB",
    "battery_capacity":"mAh",
    "processor_frequency":"GHz",
    "height":"mm",
    "width":"mm",
    "thickness":"mm",
    "talk_time":"hours",
    "audio_jack":"mm",
    "screen_size":"inches",
    "primary_camera_resolution":"Mp",
    "video_resolution":"pixel",
    "rear_camera_resolution":"Mp",
    "no_of_cores":"core",
    "front_camera_resolution":"Mp",
    "display_resolution":"pixels",
    "price" : "Rupees",
    "weight":"grams",
};
function isUnitExists(key){
    return mapUnits.hasOwnProperty(key);
}
function getUnitKey(key){
    return mapUnits[key];
}

let relevantAttributes = {
    "processor" : [{'processor_type' :"PROCESSOR TYPE"}, {'processor_frequency' :"PROCESSOR FREQUENCY"}],
    "processor_type" : [{'processor_type' :"PROCESSOR TYPE"}, {'processor_frequency' :"PROCESSOR FREQUENCY"}],
    "ram" : [ {'ram_memory' : "RAM MEMORY"} ],
    "internal memory" : [  {'internal_memory' : "INTERNAL MEMORY"}],
    "external memory" : [ { "expandable_memory" : "EXPANDABLE MEMORY"}],
    "primary camera resolution" : [ {"primary_camera_resolution" : "CAMERA RESOLUTION"}],
    "video resolution" : [ {"video_resolution" : "VIDEO RESOLUTION"}],
    "pixel density" : [{"screen_pixel_density" : "SCREEN PIXEL DENSITY"}],
    "screen size" : [{"screen_size" : "SCREEN SIZE"}],
    "talk time" : [ {"talk_time" : "TALK TIME"}],
    "battery_capacity" : [ {"battery_capacity" : "BATTERY CAPACITY"}],
    "cores" : [ {"no_of_cores" : "NO OF CORES"}],
    "processor frequency" : [ {"processor_frequency" : "PROCESSOR FREQUENCY"}],
    "thickness" : [ {"thickness" : "THICKNESS"}],
    "network_support" : [ {"network_support" : "NETWORK SUPPORT"}],
    "brand" : [ {"brand" : 'BRAND'}],
    "popular" : [ {"primary_camera_resolution": "CAMERA RESOLUTION"},
                  {ram_memory: " RAM MEMORY"},
                  {'processor_type' :"PROCESSOR TYPE"},
                  {battery_capacity : "BATTERY CAPACITY"}],
    "sim_size" : [ {"sim_size" : "SIM SIZE"}],
    "sim_type" : [ {"sim_type" : "SIM TYPE"}],
    "battery_type" : [ {"battery_type" : "BATTERY TYPE"}],
    "display_type" : [ {"display_type" : "DISPLAY    TYPE"}],
    "sensor_type" : [ {sensor_type : "SENSOR TYPE"}],
    "gpu_type" : [ {gpu : "GPU"}],
    "screen_protection" : [ {screen_protection : "SCREEN PROTECTION"}],
    "video_formats" : [ {video_formats : "VIDEO FORMATS"}],
    "flash_type"  : [ {"flash_type" : "FLASH TYPE"}],
    "frames per second" : [ {frames_per_second : "FRAMES PER SECOND"}],
    "camera" : [{"primary_camera_resolution": "CAMERA RESOLUTION"},
        {"front_camera_resolution": " FRONT CAMERA RESOLUTION"},
        {"video_resolution": " VIDEO RESOLUTION"},
        {"internal_memory": " INTERNAL MEMORY"}],
    "performance" :  [
        {gpu : "GPU"},
        {ram_memory: "RAM MEMORY"},
        {processor_type : "PROCESSOR TYPE" },
        {processor_frequency : "PROCESSOR FREQUENCY"}],
    "battery" :  [
        {battery_capacity : "BATTERY CAPACITY"},
        {battery_type : "BATTERY TYPE"},
        {non_removable_battery: " NON REMOVABLE BATTERY"},
        {stand_by_time : "STANDBY TIME" } ],
    "display" : [
        {screen_size: "SCREEN SIZE"},
        {display_resolution : "DISPLAY RESOLUTION"},
        {display_type: " DISPLAY TYPE"},
        {screen_pixel_density : "PPI" },
        {battery_capacity : "BATTERY"},
        {video_resolution : "VIDEO RESOLUTION"}],
    "front camera resolution" : [
        {front_camera_resolution: "FRONT CAMERA RESOLUTION"},
        {primary_camera_resolution : "PRIMARY CAMERA RESOLUTION"},
        {video_resolution: " VIDEO RESOLUTION"},
        {auto_focus : "AUTO FOCUS" },
        {flash_type : "FLASH TYPE"},
        {internal_memory : "INTERNAL MEMORY"}],
    "memory" : [
        {micro_sd_slot: "MICRO SD SLOT" },
        {"internal_memory" :"INTERNAL MEMORY"},
        {"expandable_memory" : "EXPANDABLE MEMORY" },
        {ram_memory: "RAM MEMORY"}
    ],

    "overall" : [
        {battery_capacity : "BATTERY CAPACITY"},
        {screen_size: "SCREEN SIZE"},
        {ram_memory: " RAM MEMORY"},
        {"primary_camera_resolution": "CAMERA RESOLUTION"},
        {"internal_memory": " INTERNAL MEMORY"}
    ],
    "phonelist_videos" : [
        {video_resolution: " VIDEO RESOLUTION"},
        {screen_size: "SCREEN SIZE"},
        {display_resolution : "DISPLAY RESOLUTION"},
    ],
    "phonelist_autofocus" : [
        {auto_focus: " AUTO FOCUS "},
    ],
    "water proof" : [{water_proof_rate : "WATER PROOF"}],
    "micro sd slot" : [ {micro_sd_slot : "MICRO SD SLOT"}],
};

function hasReleventAttriubte(key){
    return relevantAttributes[key];
}
function getRelevantAttribute(key){
     return relevantAttributes[key];
}
const listReasonMessages = {
    'processor' :"List is sorted based on the popular AnTuTu and Notebookcheck processor benchmark scores.",
    'memory' :"List is sorted based on the the sum of internal memory and expandable memory of the phones.",
    'gpu':"List is sorted based on the popular AnTuTu and Notebookcheck benchmark scores for GPUs.",
    'rating':"Best rated phones are ranked in such a way that the phones with highest average rating from Flipkart and amazon in the given price is ranked first.",
    'phone': 'List is sorted based  on specifications, user reviews and critic reviews.',
    'camera': 'List is sorted based on camera specifications and expert camera reviews.',
    'performance': 'List is sorted based on processor type, RAM size and expert performance reviews.',
    'battery': 'List is sorted based on battery capacity, stand by time, talktime and battery life reviews by users.',
    'display' : 'List is sorted based on display resolution, display_type, ppi and expert reviews on display.',
    'popular' : 'List is sorted based on Popularity index, specifications, user and critic reviews.',
    'overall' :'List is sorted based  on specifications, user reviews and critic reviews',
    'slim' : 'List is sorted based on minimum thickness in your selected price range',
    'phonelist_autofocus' : 'List is sorted based on best autofocus system in your selected price range',
    'phonelist_videos' : 'List is sorted based on video resolution and also expert camera reviews in your selected price range',
    'ram' :"List is sorted based on RAM size, phone specifications, expert and user reviews",
    'internal memory':"List is sorted based on internal memory, phone specifications and user ",
    "stand by time":"List is sorted based on standby time, phone specifications, expert and user reviews",
    "cores":"List is sorted based on number of cores, phone specifications, expert and user ",
    "external memory":"List is sorted based on external memory, phone specifications, expert and user reviews",
    "primary camera resolution":"List is sorted based on primary camera resolution, phone specifications, expert and user",
    "video resolution":"List is sorted based on video resolution, phone specifications, expert and user reviews",
    "display resolution":"List is sorted based on display resolution, phone specifications, expert and user reviews",
    "thickness":"List is sorted based on thickness, phone specifications, expert and user reviews",
    "talktime" :"List is sorted based on talktime, phone specifications, expert and user reviews",
    "front camera resolution": "List is sorted based on primary camera resolution, phone specifications, expert and user reviews",
    'filters' :'List is sorted based  on specifications, user reviews,critic reviews and your modified filters',
};

function isReasonExists(key) {
    return listReasonMessages.hasOwnProperty(key);
}

function getReasonMessage(key) {
    if(isReasonExists(key))
        return listReasonMessages[key] ;
    else
        return "List is sorted based as per phone specifications, expert and user reviews" ;
}
const mapSKUKeys ={
    'model_name':"MODEL NAME",
    'price': "PRICE",
    'os':"OS",
    'sim_type':"SIM TYPE",
    'display_type':"DISPLAY TYPE",
    'sim_size' :"SIM SIZE",
    'network_support' : "NETWORK SUPPORT",
    'primary_camera_resolution' : "CAMERA RESOLUTION",
    'front_camera_resolution' : "FRONT CAMERA RESOLUTION",
    'ram_memory' : "RAM MEMORY",
    'internal_memory' : "INTERNAL MEMORY",
    'removable_battery' :"REMOVABLE BATTERY",
    'flash_type': "FLASH TYPE",
    'primary_camera_features' :"PRIMARY CAMERA FEATURES",'auto_focus' :"AUTO FOCUS",
    'aperture' :"APERTURE",
    'battery_capacity':"BATTERY CAPACITY",
    'battery_type' :"BATTERY TYPE",
    'stand_by_time':"STAND BY TIME",
    'talk_time' : "TALK TIME",
    'processor_type' :"PROCESSOR TYPE",
    'processor_frequency' :"PROCESSOR FREQUENCY",
    'no_of_cores':"No Of Cores",'gpu':"GPU",
    'Network_support':"NETWORK SUPPORT",
    'gps_type':"GPS TYPE",'wifi_type':"WIFI TYPE",
    'micro_sd_slot' :"MICRO SD SLOT",'expandable_memory':"EXPANDABLE MEMORY",
    'weight':"WEIGHT",'phone_height':"PHONE HEIGHT",'phone_width':"PHONE WIDTH",'thickness':"THICKNESS",
    'average_rating_flipkart':"FLIPKART RATING", 'no_of_ratings_flipkart':"NO OF RATINGS FLIPKART",
    'average_rating_amazon':"AMAZON RATING",'no_of_ratings_amazon':"NO OF RATINGS AMAZON",'average_rating':"AVERAGE RATING",
    'screen_size': "SCREEN SIZE",
    'processor_rank' : "PROCESSOR RANK",
    'display_resolution':"DISPLAY RESOLUTION",
    'brand' : "BRAND",'display_type ':'DISPLAY TYPE',
    'screen_protection':'SCREEN PROTECTION',
    'screen_pixel_density': 'SCREEN PIXEL DENSITY',
    'video_resolution':"VIDEO RESOLUTION"
};
function isSKUKeyExists(key){
    return mapSKUKeys.hasOwnProperty(key);
}
function getSKUKey(key){
    return mapSKUKeys[key];
}
const functionContextMap = {
    "positiveSKU" : [['pos_expressions', 'model_name'],['mobile']],
    "negativeSKU" : [['neg_expression', 'model_name'],['mobile']],
    "opinionSKU" : [['opinion', 'model_name'],[]],
    "getAttributeValueSKU" : [['attribute','model_name'],['mobile','absa']],
    "getAttributeValueALL" :[['attribute','price_range'],['mobile']],
    "singlePhoneDetails" : [['model_name'],['public','preference','filter','absa']],
    "specsOfSKU" : [['model_name','features'],[]],
    "specReview":[['model_name','features','verdict'],[]],
    "SKUReview":[['model_name','verdict'],[]],
    "howSpecs":[['how','model_name'],[]],
    "knowledgeQuestion" : [['query'],['model_name']],
    // "bestAttributeInMarket" : [['best', 'attribute'],['mobile']],
    "publicTalk" : [['public','model_name'],[]],
    // "buyPhone" : [['where', 'buy', 'model_name'],[]],
    "negExpression" : [['neg_expression'],["features","mobile","attribute"]],
    "posExpression" : [['pos_expressions'],["features","mobile","attribute"]],
    "ratingMobile" : [['rating', 'model_name'],[]],
    "compareMobiles" : [['compare','model_name1', 'model_name2'],[]],
    "betterPhoneInTwo" : [['better', 'model_name1', 'model_name2'],[]],
    "betterThanSKU":[['better', 'model_name'],[]],
    "betterThanPhone":[['better','mobile'],['feature','attribute']],
    "findAllPhones" : [['mobile'],[]],
    "findGenderMobile" : [['mobile','gender'],['model_name']],
    "dimensionsSKU": [['dimensions','model_name'],[]],
    "similarPhones" : [['similar','mobile','model_name'],[]],
    "checkAttributeSKU" : [['model_name','does'],[]],
    "helpMessage" : [['query', 'help'],[]],
    "greet" : [['greet'],[]],
    "destroyEverything" : [['clear'],[]],
    "profanity" : [['profanity'],[]],
    "sortPhoneList" : [['sort'],[]],
    "trivia" : [['trivia'],[]],
    "complex_sentence" : [['complex_sentence'],[]],
    "appliedFilterList" : [['filter'],[]]
};
function isKeyExists(key, context)
{
    return context.hasOwnProperty(key);
}
const mapKnowledge ={
    'processor' : "Processors also known as CPU act very much like our brains do. They allow data to be processed and moved so that the device can perform tasks, such as loading up an application or running a game. Everything the phone does is computed by the CPU",
    'gpu' : "*A Graphics Processing Unit (GPU) is a single chip processor primarily used to manage and boost the performance of video & graphics. GPU features include 2D or 3D graphics, rendering polygons, MPEG decoding etc. These features are designed to lessen the work of the CPU (graphics) and produce faster video and graphics",
    'ram' : "RAM is Random Access Memory. When your processor computes data, it is faster to retrieve data required for processing from your RAM rather than to load it from your permanent storage which takes time. Devices with more RAM can run more complex software and multiple applications at the same time" ,
    'primary camera resolution': "Resolution refers to the number of pixels in an image. It is sometimes identified by the width and height of the image as well as the total number of pixels in the image. For example, an image that is 2048 pixels wide and 1536 pixels high (2048X1536) contains (multiply) 3,145,728 pixels (or 3.1 Megapixels)",
    'battery_capacity':"Battery capacity is product of current and time. For eg: 2100mAh capacity of battery means it is a product of current and time. The mA means milli amperes and h means hours. Any smartphone usually consumes around 210mA each hr. So this battery consumes 2100mA for 10hrs",
    'expandable memory':"*This is the external storage capacity of your phone. It depends on the compatibility of the memory card slot and to what extent is it supported. It is the storage which can be removed easily (your memory card) and can be used for storing pictures etc. You may or may not be able to install applications on it",
    'internal memory':"Internal Memory is your phones built in memory which cannot be taken out of the phone. These files as mentioned take up space on your smartphone, so you may have a 16GB internal memory, but you could actually only have 15GB free  to use as 1GB is used for the in built files that make phone work",
    'processor frequency':"The clock rate typically refers to the frequency at which a chip like a central processing unit (CPU), one core of a multi-core processor, is running and is used as an indicator of the processor's speed. It is measured in clock cycles per second or its equivalent, the SI unit hertz (Hz)",
    'gps':"General Packet Radio Services (GPRS) is a packet based wireless communication service that promises data rates from 56 up to 114 Kbps and continuous connection to the Internet for mobile phone and computer users. GPRS is based on Global System for Mobile (GSM) communication",
    'talk time' : "Talktime is the battery life it means that you are supposed to be able to talk on the phone for that many minutes before you need to recharge the battery",
    'stand by time' : "Standby time refers to the amount of time a phone can remain powered on while not being used. And I mean not being used in the sense of at all. That means no incoming or outgoing texts, messages, phone calls, emails or any thing else that alters the data on the phone",
    'cores' : "Core is an element found in the main processor that reads and executes instructions. Devices began with a single-core processor, but now more powerful devices with dual, quad, hexa and octa cores are available. Multiple cores make your experience snappy: Apps load quickly",
    'micro_sd_slot':"Micro SD is one of the smallest memory card formats available; a microSD card is about the size of a fingernail. ",
    'gprs': "GPRS is a technology used for transferring data over a cellphone network.",
    "auto focus" : "Auto-focus is a feature of digital cameras that allows them to focus correctly on a subject. It enhances the quality of the photo over fixed-focus cameras and allows for close-ups (or the even closer macro shots).",
    "a gps" : "Assisted GPS (A-GPS) is used to speed up start-up times of GPS-based positioning systems. GPS may have problems getting a lock when the signal is weak and in such a case A-GPS would assist in getting a lock.",
    "auto hdr" : "HDR stands for High Dynamic Range imaging, and it's an old photography practice recently introduced to cameraphones like the iPhone and some Android devices. The Auto HDR function cuts out the postprocessing time, effort and gives HDR image instantly",
    "panorama" : "A panorama is any wide-angle view or representation of a physical space, whether in painting, drawing, photography, film, seismic images or a three-dimensional model",
    "sensors" : "Modern mobile phones come with a variety of sensors that automate or easy many of our daily tasks.",
    "auto foucs" : "Auto-focus is a feature of digital cameras that allows them to focus correctly on a subject. It enhances the quality of the photo over fixed-focus cameras and allows for close-ups (or the even closer macro shots).",
    "aperture" : "Aperture is essentially an opening of a lens's diaphragm through which light passes. It works much like the iris and pupil of an eye, by controlling the amount of light which reaches the retina. A bigger aperture hole lets your smartphone camera sensor gather more light, which it needs to produce quality images.",
    "video resolution" : "the number represents the number of horizontal lines the video has from top to bottom. A 480p video is made up of 480 lines stacked one on top of another, with each line being 852 pixels wide – that’s what it means when people say a video’s resolution is 852×480.",
    "hd-r" : "High-definition video is video of higher resolution and quality than standard-definition. While there is no standardized meaning for high-definition, generally any video image with considerably more than 480 horizontal lines (North America) or 576 horizontal lines (Europe) is considered high-definition",
    "fps" : "This measurement is the video resolution measured in time. 24-30 fps is the normal level for good picture quality. A video with lower framerates appear as “choppy” on screen and fail to capture fast moving objects properly.",
    "bluetooth" : "Bluetooth is a wireless protocol for exchanging data over short distances from fixed and mobile devices, creating personal area networks.",
    "wifi" : "Wi-Fi is a WLAN (Wireless Local Area Network) technology. It provides short-range wireless high-speed data connections between mobile data devices (such as laptops, PDAs or phones) and nearby Wi-Fi access points (special hardware connected to a wired network).",
    "photo resolution" : "A term that refers to the number of pixels on a display or in a camera sensor (specifically in a digital image). A higher resolution means more pixels and more pixels provide the ability to display more visual information (resulting in greater clarity and more detail).",
    "pixel density" : "Refers to the concentration of pixels on a particular display, measured in pixels per inch (ppi). Pixel density is calculated by dividing the diagonal pixel resolution of a display by its diagonal size.",
    "usb type" : "USB is a standard for a wired connection between two electronic devices, including a mobile phone and a desktop computer. The connection is made by a cable that has a connector at either end.",
    "accelerometer" : "An accelerometer is a sensor that measures changes in gravitational acceleration of a device. These are used to measure acceleration, tilt and vibration.",
    "ambient light sensor" : "Ambient light sensors can adjust display’s backlight which improves user experience and power savings by optimizing the display's viewability.",
    "barometer" : "The barometer is a sensor to check altitude and will give you a faster GPS signal.",
    "compass" : "Digital compass is a sensor which provides mobile phones with a simple orientation in relation to the Earth's magnetic field. As a result, your phone always know which way is North so it can auto rotate your digital maps depending on your physical orientation.",
    "proximity sensor" : "A proximity sensor is a sensor which detects the presence of nearby objects without any physical contact. Proximity sensors are commonly used in smartphones to detect (and skip) accidental touchscreen taps when held to the ear during a call",
    "magnetic sensor" : "The Magnetic sensor in your smartphone is not an actual magnet, it is however capable of sensing the magnetic field of earth (using Halls effect) to determine your direction. With Magnetic compass turned on, your navigation will be more precise.",
    "gyroscope" : "Gyroscope sensor can provide orientation information as well, but with greater precision. Android's Photo Sphere camera feature can tell how much a phone has been rotated and in which direction.",
    "fingerprint sensor" : "Finger print sensor is used as an extra layer of security as a substitute for a lock screen password.",
    "heart rate" : "Heartrate sensor can check the heart rate.It enables users to monitor their physical information",
    "rgb sensor" : "RGB Sensor measures the intensity of the light and is applied to the Adapt Display, which optimizes screen to surroundings.",
    "hall sensor" : "Hall sensor recognizes whether the cover is open or closed.",
    "gesture" : "Gesture sensor recognizes hand movements by detecting infrared rays that are reflected from the user’s palm.",
    "pedometer" : "Pedometer sensor used for counting the number of steps that the user has taken.",
    "pressure sensor" : "Pressure Sensor is useful for monitoring air pressure changes",
    "humidity" : "Humidity Sensor is useful for measuring air temperature and humidity",
    "android sensor hub" : "Android Sensor hub helps to integrate data from different sensors and process them for example the phone knows when it's been picked up and will automatically display notifications in a low-power white-on-black text until the screen has been properly activated",
    "stereo headset" : "Headphones that play back distinct sounds out of the two speakers, the left speaker and the right speaker normally we use them.",
    "datacable" : "A data cable is a cable that provides communication between devices like pc and mobile",
    "simtray" : "Simtray is sim card holder which is used to insert sim card into mobile",
    "eject tool" : "Eject tool is a pin like tool to eject sim card",
    "sar" : "SAR is a measure of the rate at which energy is absorbed by the human body when exposed to a radio frequency (RF) electromagnetic field",
    "charging adapter" : "Equipment which is used for charging mobile",
    "a-gps" : "Assisted GPS (A-GPS) is used to speed up start-up times of GPS-based positioning systems. GPS may have problems getting a lock when the signal is weak and in such a case A-GPS would assist in getting a lock.",
    "hotspot" : "Tethering is when you turn you smartphone into a mobile Wi-Fi hotspotand share your phones 3G/4G data connection. Once you've turned tethering on, any device with a wireless connection can connect to the internet via your smartphone's connection",
    "dlna" : "The DLNA standard is used for sharing music, photos and video over an existing home network. For example, by using DLNA you could stream video from your phone to a compatible TV-set using a Wi-Fi network",
    "wifi-direct" : "a Wi-Fi standard enabling devices to easily connect with each other without requiring a wireless access point. It is useful for everything from internet browsing to file transfer, and to communicate with one or more devices simultaneously at typical Wi-Fi speeds.",
    "amoled" : "AMOLED screens are having HD 720 x 1280 resolution, they have wide viewing angles and can even be made transparent or flexible.They tend to have great contrast, as the light on the screen comes from each individual pixel rather than a backlight",
    "super amoled" : "Super AMOLED are having Full HD 1080 x 1920 resolution and are having comparitivelyAMOLED thse screen is thinner, lighter, more touch sensitive and less power-hungry, but without that extra layer it's also far less reflective than a typical AMOLED screen, making it easier to view in bright sunlight.",
    "super lcd" : "Suuper LCD lights each pixel individually,unlike an AMOLED display which an LCD has a backlight, so the whole screen is lit to some extent, even supposedly black areas.",
    "ips lcd" : "An IPS-LCD is a sort of thin display that offers preferred viewing angles over TFT-LCD",
    "tft lcd" : "The Thin film transistor liquid crystal display (TFT LCD) technology is the most common display technology used in mobile phones",
    "oled" : "In OLED,the light on the screen comes from each individual pixel rather than a backlight",
    "usb on the go" : "USB OTG (USB On The Go) is a standard that enables mobile devices to talk to one another. Traditionally mobile devices could only connect to a Mac/PC by USB, but USB OTG makes it possible for devices to connect directly to each other.",
    "micro usb" : "Micro USB will be slightly smaller than Mini-USB, the Micro-USB Type-B port is currently the most popular USB port design for latest smartphones and tablets.",
    "mini usb" : "Mini USB is significantly smaller, these ports are found in older portable devices, such as digital cameras, smartphones, and older portable drives. This design is becoming obsolete.",
    "reversible connector" : "Type-C USB also allows for bi-directional power, so apart from charging the peripheral device, when applicable, a peripheral device could also charge a host device",
    "usb host" : "USB Hosts allows you to connect storage devices, like a flash drive, to the phone and use them.In other contexts it can allow for connection of input devices like keyboards and mice.",
    "dual sim" : "Dual SIM means it is possible to use two sim cards in same mobile",
    "standard sim" : "A SIM is called Standard SIM if it is around two and a half centimetres long, and one and a half centimetres wide.",
    "micro-sim" : "A SIM is called Micro SIM,if it is having 12x15mm dimensions.It is the most commonly used SIM in smartphones.",
    "nano-sim" : "A SIM is called Nano SIM,if it is having 8.8x12.3mm dimensions",
    "mini-sim" : "A SIM is called Mini SIM,if it is having 15×25mm dimensions",
    "glonass" : "GLONASS is precise over GPS.",
    "a-glonass" : "AGLONASS brings features such as turn by turn navigation, real time traffic data and more. It uses the cell towers near your location to lock your location quickly with the help from your data connection.",
    "bds" : "BDS is useful for Chinese people to locate the places easily.",
    "adreno" : "Adreno is a Graphic Processing Unit developed by Qualcomm",
    "mali" : "Mali is a Graphic Processing Unit developed by ARM.",
    "power vr" : "Power VR is a Graphic Processing Unit developed by Imagination Technologies",
    "snapdragon" : "Qualcomm Snapdragon is a popular processor chipset series from Qualcomm. It is known for breathtaking speed, jaw-dropping graphics, ultra-fast connectivity and longer battery life on your mobile device so you can do more of the things you love",
    "mediatek" : "Mediatek is a company that produces popular processor chipset series called 'MediaTek' series. Delivering extreme computing performance with unmatched power efficiency, some of the new MediaTek processor is set to revolutionize the smartphone industry.",
    "intel atom" : "Intel Atom Processors also deliver more heat when running heavy and CPU intensive tasks or while using for long duration",
    "samsung exonys" : "It has some heating issues.Performance wise good.It is built by Samsung.",
    "apple a" : "Built by Apple Inc.",
    "octacore" : "Octa core processor will have 2 pairs of quad cores(8 cores).It consume high power and suffers from heating issues,but performance may increase for some programs",
    "dualcore" : "Dual core processor has combined the processing power two processors by having two cores.",
    "hexacore" : "Hexa core processor will have 6 cores of processor",
    "quadcore" : "Quad core processor will have 4 cores of processor for better performance",
    "3g" : "3G can provide speed upto 5 Mbps/100Mbps",
    "4g" : "4G can give more speed compared to 3G,theoretically 500 Mbps/1Gbps.But practically it is possible only with LTE.",
    "lte" : "LTE can provide more speed than 4G.",
    "li-ion" : "lithium-ion batteries do suffer from aging – even when not in use.",
    "li-po" : "Li-Polymer batteries allow for a slight increase in energy density,very lightweight and have improved safety.However, this advantage is offset by a 10% to 30% cost increase.",
    "aac" : "AAC is a file format for storing digital audio. It's commonly used for storing music on the Internet, PCs and portable music players and phones.It is similar to MP3, but it was designed to be its successor and offers better quality and smaller file sizes. It also supports DRM, which enforces copyright.",
    "alac" : "it is an audio coding format, and its reference audio codec implementation developed by Apple Inc. for lossless data compression of digital music",
    "gorilla" : "Gorilla glass is mainly used for screen protection.It is designed to be thin, light and damage-resistant"
};
function haveKnowledge(key){
    return mapKnowledge.hasOwnProperty(key);
}

function getKnowledge(key){
    return mapKnowledge[key];
}
//fields
const attributeFieldMappings = {
    phone :  ['price','brand', 'os','screen_size', 'processor_type', 'ram_memory', 'internal_memory','battery_capacity','primary_camera_resolution'],
    camera : ['primary_camera_resolution','flash_type','front_camera_resolution','auto_focus','aperture'],
    battery : ['battery_capacity','battery_type','stand_by_time','talk_time'],
    performance : ['processor_type','processor_frequency','no_of_cores','gpu','ram_memory'],
    connectivity : ['Network_support','gps_type','wifi_type'],
    network : ['Network_support','gps_type','wifi_type'],
    storage : ['internal_memory','micro_sd_slot','expandable_memory'],
    memory : ['internal_memory','micro_sd_slot','expandable_memory'],
    dimensions: ['weight','phone_height','phone_width','thickness'],
    rating: ['average_rating_flipkart','no_of_ratings_flipkart','average_rating_amazon','no_of_ratings_amazon','average_rating'],
    video: ['video_resolution','hd_recording','frames_per_second','video_formats'],
    audio : ['music_player','loudspeaker','audio_jack','audio_formats','FM'],
    display: ['display_resolution','display_type','screen_protection','screen_pixel_density','screen_size'],
    general: ['brand','model_name','os','price','announced_date','available_colors','in_the_box'],
    pros : ['pros'],
    cons : ['cons'],
    os : ["os_name"],
    howz :['pros','cons'],
    better : ['overall_score','internal_memory','ram_memory','battery_capacity','primary_camera_resolution','price'],
    model_name : ['model_name','price','os','screen_size', 'primary_camera_resolution','front_camera_resolution','display_resolution',
        'processor_type','no_of_cores', 'ram_memory','internal_memory','battery_capacity','removable_battery'],
    skuandroid : ['id','model_name','aperture','price','os','screen_size','front_camera_resolution','display_score',"usb_type",
        'brand','announced_date','os','version_name','version','gpu_type','gpu_rank','auto_focus',"processor_rank",
        'no_of_cores','ram_memory','verdict_review','primary_camera_resolution','battery_score','overall_score',
        'removable_battery','battery_capacity','battery_type','internal_memory','micro_sd_slot',"video_resolution","water_proof_rate",
        'pros','cons','average_rating_flipkart','average_rating_amazon','no_of_ratings_flipkart','no_of_ratings_amazon',
        'phone_height','phone_width','thickness','weight','flash_type','primary_camera_features','display_type','display_resolution',
        'screen_pixel_density','FM','screen_protection','processor_type','processor_frequency','non_removable_battery',
        'gpu','expandable_memory','video_formats','audio_formats','hd_recording','loudspeaker','audio_jack','performance_score',
        'stand_by_time','talk_time','wifi_type','gps_type','network_support','usb_type','pic_urls','sim_type','sim_size',
        'pics_urls','average_rating','in_the_box','available_colors','sensors','purchase_url','overall_score','camera_score'],
    testing :['model_name']
};

function getFieldsAttribute(key){
    if(attributeFieldMappings.hasOwnProperty(key))
        return attributeFieldMappings[key];
    return [];
}
const specsScores = {
    "camera" :"camera_score",
    "battery":"battery_score",
    "display":"display_score",
    "performance":"performance_score",
    "capacity":"battery_capacity",
    "overall" :"overall_score",
    "rating" :"average_rating",
    "camera_resolution":"primary_camera_resolution",
    "front_camera_resolution":"front_camera_resolution",
    "pixel density":"screen_pixel_density",
    "internal memory":"internal_memory",
    "expandable memory":"expandable_memory",
    "thickness": "thickness",
    "screen size" :"screen_size",
    "weight":"weight",
    "os":"os_rank",
    "video resolution":"video_resolution",
    "average rating":"average_rating"
};

function getSpecScores(key){
    return specsScores[key];
}
function hasSpecScores(key){
    return specsScores.hasOwnProperty(key);
}

module.exports = {
    isSpecSortKeyExists     : isSpecSortKeyExists,
    specsSortValue          : specsSortValue,
    isUseCaseQuestionExists : isUseCaseQuestionExists,
    getUseCaseQuestion      : getUseCaseQuestion,
    isUnitExists            : isUnitExists,
    getUnitKey              : getUnitKey,
    hasReleventAttriubte    : hasReleventAttriubte,
    getRelevantAttribute    : getRelevantAttribute,
    isSKUKeyExists : isSKUKeyExists,
    getSKUKey : getSKUKey,
    functionContextMap : functionContextMap,
    isKeyExists : isKeyExists,
    haveKnowledge : haveKnowledge,
    getKnowledge : getKnowledge,
    isDbKeyExists : isDbKeyExists,
    getDbKey : getDbKey,
    getFieldsAttribute : getFieldsAttribute,
    hasSpecScores : hasSpecScores,
    getSpecScores : getSpecScores
};