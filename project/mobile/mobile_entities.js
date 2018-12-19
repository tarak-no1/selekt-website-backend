const fs = require("fs");
const mobile_mapping = JSON.parse(fs.readFileSync("mobile/mobile_mapping.json"));
const msg_mapping = JSON.parse(fs.readFileSync("mobile/mobile_msg_mapping.json"));
const noNoWords = ["if","but","until","not","nor","yet","unless","doesn't","don't","didn't","can't","whether","as musch as",
"where as","because","besides","however","neverthless","nonetheless","instead","otherwise","rather","accordingly","consequently",
"hence","meanwhile","furthermore","likewise"];

const broad_catagory = ["topwear","top wear"];
function getEntities(message, callback)
{
	message = message.toLowerCase();
    message = message.split("-").join(" ");
    message = message.replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, '');

    let json_keys = Object.keys(msg_mapping);
    //based on the key length sorting the array in ascending order
    let require_values = requireValues(json_keys, message);
    let entity_values = require_values["require_values"];
    message = require_values["message"].trim();
    entity_values = entity_values.map(function(value)
    {
        return msg_mapping[value];
    });
    let entities = {};
    for(let i in entity_values)
    {
    	let value = entity_values[i];
    	if(!entities.hasOwnProperty(value.key_name))
    		entities[value.key_name] = [];
    	entities[value.key_name].push(value.main_value);
    };

    //getting negative words from the message
    let negative_words = requireValues(noNoWords,message);
    message = negative_words["message"].trim();
    if(negative_words["require_values"].length > 0)
        entities.negative_words = negative_words["require_values"];
    
    let remove_words = requireValues(["remove"],message);
    message = remove_words["message"].trim();
    if(remove_words["require_values"].length > 0)
        entities.type = "remove";

    // getting the range values are present in the message

    if(message.length>0)
    {
        let range = checkForRange(message);
        entities = Object.assign(range, entities);
    }
    callback(entities);
}
//getting the values present in the message.
function requireValues(json_keys, message)
{
    json_keys = json_keys.sort(function(a,b)
    {
        return b.length - a.length;
    });
    let require_values = [];
    for(let i in json_keys)
    {
        let value = json_keys[i].toLowerCase();
        let value_index = message.indexOf(value);
        if(value_index!=-1)
        {
            if(value_index==0 && (value_index+value.length)<message.length)
            {
                if(message.charAt(value_index+value.length)==" ")
                {
                    message = message.replace(value,"");
                    require_values.push(json_keys[i]);
                }
            }
            else if(value_index>0 && (value_index+value.length)==message.length)
            {
                if(message.charAt(value_index-1)==" ")
                {
                    message = message.replace(value,"");
                    require_values.push(json_keys[i]);
                }
            }
            else if(value_index==0 && (value_index+value.length)==message.length)
            {
                message = message.replace(value,"");
                require_values.push(json_keys[i]);
            }
            else if(value_index>0 && (value_index+value.length)<message.length)
            {
                if(message.charAt(value_index-1)==" " && message.charAt(value_index+value.length)==" ")
                {
                    message = message.replace(value,"");
                    require_values.push(json_keys[i]);
                }
            }
        }
    }
    return {require_values:require_values,message:message};
}
function checkForRange(message)
{
    let entities = {};
    let numbers = message.match(/[-]{0,1}[\d.]*[\d]+/g);
    for(let i in numbers)
    {
        let number = numbers[i].toString();
        try{
            if(message[message.indexOf(number)+number.length]=="k")
                numbers[i] = number*1000;
        }catch(e){}
    }
    try{
        if(numbers.length>0)
        {
            entities.numbers = numbers;
        }
    }catch(e){}
    return entities;
}
module.exports = 
{
	getEntities : getEntities
};