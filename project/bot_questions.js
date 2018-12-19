module.exports = {
	textMessages: function(message)
	{
		let text_message = 
		{
			type : "text",
			message: message
		}
		return text_message;
	},
	noEntitiesMessage: function()
	{
		let message = this.textMessages("Sorry, I'm not able to understand your question.");
		return message;
	},
	makeOptions : function(values)
	{
		let options = [];
		options = values.map(function(val){
			return {
				"key":val,
				"value":val
			}
		});
		return options;
	},
	sendSuggestionsMessage : function()
	{
		let message = this.textMessages("You can ask me things like :"
                +" \n\t- Kurtas"
                +" \n\t- Jeans under 999"
                +"\n\t- Dresses to hide tummy"
                +"\n\t- Pastel color tshirts"
                +"\n\t- Need a skirt for a date");
        return message;
	},
	occasionQuestion : function (broad_occasion, sub_occasions)
	{
		let options = this.makeOptions(sub_occasions);
		let nothing_option = {
			key: "nothing",
			value: "Nothing"
		};
		options.push(nothing_option);

		let question = {
			type: "single_select",
			text: "Anything specific in "+broad_occasion+"?",
			belongs : "occasionQuestion",
			options: options
		}
		return question;
	},

	occasionInfoMessage: function()
	{
		let occasion_info_question = this.textMessages("I can further narrow down your list based on your occasion.");
        return occasion_info_question;
	},
	broadOccasionQuestion : function(product_line, broad_occasions)
	{
		let options = this.makeOptions(broad_occasions);
		let nothing_option = {
			key: "nothing",
			value: "No occasion in my mind"
		};
		options.push(nothing_option);

		let question = {
			type: "single_select",
			text: "Which occasion are you planning to buy "+product_line+" for?",
			belongs : "broadOccasionQuestion",
			options: options
		}
		return question;
	},
	bodyProfileQuestion : function(profile_question_object)
	{
		let question = {
            type : "profile_question",
            text : "Tell us about yourself:",
            belongs : "bodyProfileQuestion",
            options:profile_question_object
        };
        return question;
	},
	bodyProfileReasons: function(reasons)
	{
		let profile_reasons = {
            type : "profile_reasons",
            text: "Your list has been sorted based on profile priority.",
            options : reasons
        };
        return profile_reasons;
	},
	bodyConcernQuestion : function(body_concerns_array){
		let question = {
            type : "body_concerns_question",
            text: "Any body concerns that I should be aware of? So that, I can include them to prioritize the list",
            belongs : "bodyConcernQuestion",
            options : body_concerns_array
        };
        return question;
	},
	bodyConcernReasons: function(reasons)
	{
		let concern_reasons = {
            type : "profile_reasons",
            text: "Based on your body concerns",
            options : reasons
        };
        return concern_reasons;
	},
	preEndQuestion : function()
	{
		let question = {
	        type: "single_select",
	        text: "Do you want to:",
	        belongs : "preEndQuestion",
	        options: 
	        [
	            {
	                key:"refine_the_list",
	                value:"Further refine the list"
	            },
	            {
	                key:"give_feed_back",
	                value:"Give feedback"
	            }
	        ]
	    };
	    return question;
	},
	feedbackQuestion: function()
	{
		let feedback_question = 
        {
            type : "feedback_question",
            text : "How was your experience?",
            belongs: "feedbackQuestion",
            options:[
                {
                    "key": "Loved it",
                    "value": "Loved it"
                },
                {
                    "key": "Bad",
                    "value": "Bad"
                },
                {
                    "key": "other",
                    "value": "Other"
                }
            ]
        };
        return feedback_question;
	},
	profileInfoMessage: function()
	{
		let info_message = this.textMessages("I can further prioritize list based on your body profile and body concerns.");
        return info_message;
	},
	userProfileStatusQuestion : function(user_profile)
	{
		let profile_status_question =
        {
            type : "display_body_profile",
            header: "Your profile",
            body : "Age: "+user_profile["age"]+"\nHeight: "+user_profile["height"]+"\nBody Shape: "+user_profile["bodyshape"]+"\nSkintone: "+user_profile["skintone"],
            belongs:"userProfileStatusQuestion",
            options : [
                {
                    key:"its_me",
                    value:"It's me!"
                },
                {
                    key:"not_me",
                    value:"Not me"
                },
                {
                    key:"skip",
                    value:"Skip profile"
                }
            ]
        };
        return profile_status_question
	},
	productListReasonMessage: function(user_profile)
	{
		let message = "";
		if((!user_profile.hasOwnProperty("age") && !user_profile.hasOwnProperty("height") && !user_profile.hasOwnProperty("skintone") && !user_profile.hasOwnProperty("bodyshape")) && user_profile["body_concerns"].length==0)
		{
			message = "Done. Your list is sorted based on given needs. You can now check your list";
		}
		else if((user_profile.hasOwnProperty("age") || user_profile.hasOwnProperty("height") || user_profile.hasOwnProperty("bodyshape") || user_profile.hasOwnProperty("skintone")) && user_profile["body_concerns"].length==0)
		{
			message = "Done. Your list is sorted based on body profile and other needs given. You can now check your list";
		}
		else if((!user_profile.hasOwnProperty("age") && !user_profile.hasOwnProperty("height") && !user_profile.hasOwnProperty("skintone") && !user_profile.hasOwnProperty("bodyshape")) && user_profile["body_concerns"].length>0)
    	{
    		message = "Done. Your list is sorted based on body concerns and other needs given. You can now check your list";
    	}
    	else
    	{
    		message = "Done. Your list is sorted based on both body profile and concerns. You can now check your list";
    	}
		let reason_message = this.textMessages(message);
		return reason_message;
	},
	conversationCompleteMessage: function()
	{
		let conversation_message = this.textMessages("We are done!\nPlease view my recommended products!");
		return conversation_message;
	},
	occasionProductlineQuestion: function(occasion, product_lines)
	{
		let values = product_lines.map(function(val)
		{
			return {
				key: occasion+" "+val,
				value: val
			};
		});
		let question = {
			type: "single_select",
			text: "Choose a clothing line for "+occasion,
			belongs : "occasionProductlineQuestion",
			options: values
		};
		return question;
	},
	noProductFoundMessage: function()
	{
		let no_product_message = this.textMessages("Sorry, I have not found any products as per your need.");
		return no_product_message;
	},
	lessProducts: function(products_count)
	{
		let less_products_message = this.textMessages("Sorry, I can not assist you further as there are only "+products_count+" products as per your need");
		return less_products_message;
	},
	noIndianWearMessage: function(){
		let no_indianwear_message = this.textMessages("Sorry, we only assist for women western wear at present. We will include indian wear soon.");
		return no_indianwear_message;
	},
	someIdentifiedQuestion: function(user_message){
		let question = {
			type: "single_select",
			multi_select: false,
			text: "Have I understood it right?",
			belongs : "someIdentifiedQuestion",
			options: [
				{
					key : user_message,
					value : "Yes"
				},
				{
					key : "no",
					value : "No"
				}
			]
		};
		return question;
	},
	greetMessage : function(){
		let greet_message = this.textMessages("Hi, I am your fashion assistant. I can help you in shortlisting clothes as per your need.");
		return greet_message;
	},
	occasionConflictQuestion : function(product_line, occasion)
	{
		let conflict_question = {
			type: "single_select",
			multi_select: false,
			text: "I am sorry, I usually don't recommend "+product_line+" for "+occasion+".\nDo you still want to see products for? ",
			belongs : "occasionConflictQuestion",
			options: [
				{
					key : occasion,
					value : occasion
				},
				{
					key : product_line,
					value : product_line
				},
				{
					key : "restart_chat",
					value : "Restart chat"
				}
			]
		};
		return conflict_question;
	},
};