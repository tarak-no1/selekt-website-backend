let helper = require('./helper');
let mapping = require('./mapping');
let elasticSearch = require('./db_config/elasticSearch');
let mongo = require('./db_config/mongoQueries');
let functions = require('./functions');
let filterList = require('./filter-list');
let entity_bot = require("./entity_bot");
let offline = require("./offline_bot");
let fs = require("fs");
let word_mapping = JSON.parse(fs.readFileSync("./json/word_mapping.json"));
let benefit_tagging = JSON.parse(fs.readFileSync("./json/benefits_mapping.json"));
let ffp_reasons = JSON.parse(fs.readFileSync("./json/ffp_reasons.json"));
function processProductList(message)
{
	entity_bot.getEntities(message, undefined, function(entities)
	{
		let query = {
	        index:"product_data",
	        body:
	        {
	            "query":
	            {
	                "bool":
	                {
	                    "must":[],
	                    "should":[]
	                }
	            },"from":from,"size":60}
	    };
        // if user query is having some entities, we need to proceed the further processes, otherwise send the blank response
        if(Object.keys(entities).length > 0)
        {
            

            fetch_Products(benefits.concat(extra_benefits), query, product_line, entities, adjectives,sort_priority_benefits,function(products_list)
            {
                callback({"product_list": products_list,"entities": entities});
            });
        }
        else
        {
            callback({},[]);
        }
	});
}
function processRelatedSearches(message)
{
	entity_bot.getEntities(message, undefined, function(entities){
		
	});
}
function processAboutMessage(message)
{
	entity_bot.getEntities(message, undefined, function(entities){
		
	});
}
function getRequireDataFromEntities(entities)
{
	let processing_object = {};
    let product_line = null;
    let extra_benefits = [], benefits = [],filters={},sort_priority_benefits=[];
    if(entities.hasOwnProperty("product_line"))
    {
        let entity_productline = entities["product_line"];
        //getting productline db_key from the mapping file
        product_line = mapping.product_line_to_db_keys[entity_productline];
        processing_object["product_line"] = product_line;
    }
    if(product_line)
    {
    	// checking the entities are having occasion or not
        if(entities.hasOwnProperty("occasion"))
        {
            //check if entities are having the broad_occasion or not, 
            // if not in entities, get the broad occasion from word_mapping file, use occasion as reference
            if(!entities.hasOwnProperty("broad_occasion"))
            {
                let broad_occasions = (entities["occasion"].broad_occasions).split(".")[1];
                let broad_occasion = word_mapping[product_line]["broad_occasions"][broad_occasions];
                if(broad_occasion.benefit_entity_key && broad_occasion.benefit_entity_key!="")
                {
                    // if benefit_entity_key is exists push it into extra_benefits
                    if(extra_benefits.indexOf(broad_occasion.benefit_entity_key)==-1)
                    {
                        extra_benefits.push(broad_occasion.benefit_entity_key);
                    }
                }
            }
            if(entities["occasion"].benefit_entity_key && entities["occasion"].benefit_entity_key!="")
            {
                // if occasion key is exists push it into most priority benefits
                if(benefits.indexOf(entities["occasion"].benefit_entity_key)==-1)
                {
                    benefits.push(entities["occasion"].benefit_entity_key);
                }
            }
        }
        //getting the broad occasion benefits if exists
        if(entities.hasOwnProperty("broad_occasion"))
        {
            if(entities["broad_occasion"].benefit_entity_key && entities["broad_occasion"].benefit_entity_key!="")
            {
                if(benefits.indexOf(entities["broad_occasion"].benefit_entity_key)==-1)
                {
                    benefits.push(entities["broad_occasion"].benefit_entity_key);
                }
            }
            // getting the occasion benefits if occasion is not exists in the user query and broad occasion is exists
            if(!entities.hasOwnProperty("occasion"))
            {
                let occasion_map = entities.broad_occasion.occasion_map;
                for(let i in occasion_map)
                {
                    let occasion_value = word_mapping[product_line]["occasions"][occasion_map[i]];
                    if(occasion_value.benefit_entity_key && occasion_value.benefit_entity_key!="")
                    {
                        // pushing these occasion benefits into extra_benefits if benefits are exists
                        if(extra_benefits.indexOf(occasion_value.benefit_entity_key)==-1)
                            extra_benefits.push(occasion_value.benefit_entity_key);
                    }
                }
            }
        }
        //getting benefits if user query having the benefit name
        if(entities.hasOwnProperty("entity_benefits"))
        {
            for(let i in entities.entity_benefits)
            {
                benefits.push(entities.entity_benefits[i].entity_key);
            }
        }
        // getting age type of benefits from the user query
        if(entities.hasOwnProperty("age"))
        {
            if(entities.age.entity_key!="")
            {
                benefits.push(entities.age.entity_key);
            }
        }
        // getting height type of benefits from the user query
        if(entities.hasOwnProperty("height"))
        {
            if(entities.height.entity_key!="")
            {
                benefits.push(entities.height.entity_key);
            }
        }
        // getting body type of benefits from the user query
        if(entities.hasOwnProperty("bodyshape"))
        {

            if(entities.bodyshape.entity_key!="")
            {
                benefits.push(entities.bodyshape.entity_key);
            }
        }
        // getting skintone type of benefits from the user query
        if(entities.hasOwnProperty("skintone"))
        {
            if(entities.skintone.entity_key!="")
            {
                benefits.push(entities.skintone.entity_key);
            }
        }
        // getting body concern type of benefits from the user query
        if(entities.hasOwnProperty("body_concerns"))
        {
            let body_concerns = entities["body_concerns"];
            for(let i in body_concerns)
            {
                let item = body_concerns[i];
                if(item.benefit_key!="")
                {
                    if(benefits.indexOf(item.benefit_key)==-1)
                    {
                        benefits.push(item.benefit_key);
                    }
                }
            }
        }
        let adjectives = [];
        if(entities.hasOwnProperty("adjectives"))
        {
            let adj = entities.adjectives;
            let count_adj = 0;
            let adj_index = Object.keys(word_mapping[product_line]["adjectives"]);
            for(let i in adj)
            {
                let index = adj_index.findIndex(item => adj[i]["key"].toLowerCase() === item.toLowerCase());
                adjectives.push(adj[i].entity_key);
                sort_priority_benefits.push(helper.getBenefitname(adj[i].entity_key, product_line, "adjectives"));
            }
        }

        //making the range query based on the user requirements
        if(entities.hasOwnProperty("range"))
        {
            let range;
            try{
                range = entities.range.type;
            }catch(e){}
            let number = entities.range.numbers;
            let range_query = {"range":{"product_filter.discount_price":{}}};
            if(range=="above" && number!=null)
            {
                range_query.range["product_filter.discount_price"].gte = number[0];
            }
            else if(range=="below" && number!=null)
            {
                range_query.range["product_filter.discount_price"].lte = number[0];
            }
            else if(number!=null && (range=="between" ||entities.number.length==2))
            {
                if(number[0]>number[1])
                {
                    let temp = number[0];
                    number[0] = number[1];
                    number[1] = temp;
                }
                
                range_query.range["product_filter.discount_price"].gte = number[0];
                range_query.range["product_filter.discount_price"].lte = number[1];
            }
            if(Object.keys(range_query.range["product_filter.discount_price"]).length>0)
                filters["range"] = range_query;
        }
        // Adding attribute value filters
        if(entities.hasOwnProperty("attribute_values"))
        {
            let attribute_values = entities.attribute_values;
            for(let i in attribute_values)
            {
                if(!filters.hasOwnProperty("product_filter."+attribute_values[i].db_key))
                    filters["product_filter."+attribute_values[i].db_key] = [];
                filters["product_filter."+attribute_values[i].db_key].push(attribute_values[i].key);
            }
        }
    }
}
module.exports =
{
	processRelatedSearches: processRelatedSearches,
	processProductList: processProductList,
	processAboutMessage: processAboutMessage
};