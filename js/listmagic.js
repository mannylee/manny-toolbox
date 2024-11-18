let ListMagic = {
	name: "ListMagic",
	friendlyName: "List Magic",
	pageElements: {
		h2Title: $("#h2_title"),
		inputDelimiter: $("#input_delimiter"),
		inputSwitchAutoDelimiter: $("#input_switch_auto_delimiter"),
		inputSwitchDeduplicate: $("#input_switch_deduplicate"),
		inputSwitchNoBlankStrings: $("#input_switch_no_blank_strings"),
		inputSwitchSortAlphabetically: $("#input_switch_sort_alphabetically"),
		inputSwitchTrimWhitespaces: $("#input_switch_trim_whitespaces"),
		inputText: $("#input_text"),
		labelTextarea: $("label[for='textarea_text']"),
		textareaText: $("#textarea_text"),
	},
	config: {
		inputTextMinLength: 3	// min length before any processing should happen
	},
	variables: {
		itemsList: []
	},
	load: ()=>{
		// Update SPA
		SPA.variables.currentPageObject = ListMagic;

		// Register listeners & configs
		ListMagic.pageElements.inputText.on("keyup", ListMagic.processRawToList);
		ListMagic.pageElements.textareaText.on("keyup", ListMagic.processListToRaw);
		ListMagic.pageElements.textareaText.on("change", ListMagic.processRawToList);
		ListMagic.pageElements.inputSwitchAutoDelimiter.on("change", function(){
			ListMagic.pageElements.inputDelimiter.prop("disabled", $(this).is(':checked'));
			ListMagic.processRawToList();
		});
		ListMagic.pageElements.inputSwitchDeduplicate.on("change", ListMagic.processRawToList);
		ListMagic.pageElements.inputSwitchSortAlphabetically.on("change", ListMagic.processRawToList);
		ListMagic.pageElements.inputSwitchTrimWhitespaces.on("change", ListMagic.processRawToList);
		ListMagic.pageElements.inputDelimiter.on("focus", function(){
			$(this).select();
		});
		ListMagic.pageElements.inputDelimiter.on("keyup", function(){
			if(ListMagic.pageElements.inputDelimiter.val().length < 1){
				// User is probably changing the custom delimiter
			} else {
				ListMagic.processRawToList();
			}
		});
		ListMagic.pageElements.inputDelimiter.on("change", function(){
			if(ListMagic.pageElements.inputDelimiter.val().length === 0){
				ListMagic.pageElements.inputDelimiter.addClass("is-invalid");
			} else {
				ListMagic.pageElements.inputDelimiter.removeClass("is-invalid");
			}
		});

		// Ready
		CommonHelpers.logger.info("loaded successfully", ListMagic.name);
	},
	destroy: ()=>{
		ListMagic = null;
	},

	// Page specific functions below this line
	// ---------------------------––––--------
	processRawToList: ()=>{
		// Length check
		// if(ListMagic.pageElements.inputText.val().length < ListMagic.config.inputTextMinLength) {
		 	// return;
		// }
		if(ListMagic.pageElements.inputText.val().length !== 0){
		
			ListMagic.variables.itemsList = ListMagic.pageElements.inputText.val()
				.split(ListMagic.autodetectDelimiter(ListMagic.pageElements.inputText.val()));
			
			// Trim whitespaces
			if(ListMagic.pageElements.inputSwitchTrimWhitespaces.prop("checked")){
				ListMagic.variables.itemsList = ListMagic.variables.itemsList.map((value)=> value.trim());
			}
			
			// De-duplicate
			if(ListMagic.pageElements.inputSwitchDeduplicate.prop("checked")){
				ListMagic.variables.itemsList = [...new Set(ListMagic.variables.itemsList)];
			}

			// Sort alphabetically
			if(ListMagic.pageElements.inputSwitchSortAlphabetically.prop("checked")){
				ListMagic.variables.itemsList = ListMagic.variables.itemsList.sort(ListMagic.sortFunction)
			}
			
			// No Blank Strings
			if(ListMagic.pageElements.inputSwitchNoBlankStrings.prop("checked")){
				ListMagic.variables.itemsList = ListMagic.variables.itemsList.filter((value)=> value.length>0);
			}

		} else {
			ListMagic.variables.itemsList = [];
			ListMagic.autodetectDelimiter("");
		}

		// Output text to textarea
		ListMagic.pageElements.textareaText.val(ListMagic.variables.itemsList.join("\n"));

		// Update the number of items in textarea description
		ListMagic.pageElements.labelTextarea.text("List" + (ListMagic.variables.itemsList.length > 0? " (" + ListMagic.variables.itemsList.length + ")" : ""));
	},
	processListToRaw: ()=>{
		let listElements = ListMagic.pageElements.textareaText.val().split("\n");

		if(ListMagic.pageElements.inputSwitchTrimWhitespaces.prop("checked")){
			listElements = listElements.map((value)=> value.trim());
		}

		ListMagic.pageElements.inputText.val(listElements.join(ListMagic.autodetectDelimiter()));
	},
	autodetectDelimiter: (text)=>{
		text = text || ListMagic.pageElements.inputText.val();

		// default = comma
		let delimiter = ",";

		// <pipe>
		if(/\|/.test(text)){
			delimiter = "|";
		}
		// <comma>
		else if(/,/.test(text)){
			delimiter = ",";
		}
		// <space>
		else if(/ /.test(text)){
			delimiter = " ";
		}


		// check if auto delimiter disabled, otherwise use default behaviour
		if(!ListMagic.pageElements.inputSwitchAutoDelimiter.is(":checked")){
			delimiter = ListMagic.pageElements.inputDelimiter.val() || delimiter;
		} 
		
		// Update UI
		ListMagic.pageElements.inputDelimiter.val(delimiter);

		return delimiter;
	},
	sortFunction: (a,b)=>{
		return a.localeCompare(b, undefined, {sensitivity: 'base'});
	}
};

ListMagic.load();
