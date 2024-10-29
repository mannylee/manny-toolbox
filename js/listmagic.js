let ListMagic = {
	name: "ListMagic",
	friendlyName: "List Magic",
	pageElements: {
		h2Title: $("#h2_title"),
		inputText: $("#input_text"),
		textareaText: $("#textarea_text"),
		inputSwitchCustomDelimiter: $("#input_switch_custom_delimiter"),
		inputDelimiter: $("#input_delimiter"),
		inputSwitchTrimWhitespaces: $("#input_switch_trim_whitespaces"),
		inputSwitchSortAlphabetically: $("input_switch_sort_alphabetically"),
		inputSwitchDeduplicate: $("#input_switch_deduplicate")
	},
	config: {
		inputTextMinLength: 3	// min length before any processing should happen
	},
	variables: {
		itemsList: []
	},
	load: ()=>{
		// Update title
		ListMagic.pageElements.h2Title.text(ListMagic.friendlyName);

		// Register listeners & configs
		ListMagic.pageElements.inputText.on("keyup", ListMagic.processRawToList);
		ListMagic.pageElements.textareaText.on("keyup", ListMagic.processListToRaw);
		ListMagic.pageElements.inputSwitchCustomDelimiter.on("change", function(){
			ListMagic.pageElements.inputDelimiter.prop("disabled", !$(this).is(':checked'));
			ListMagic.processRawToList();
		});
		ListMagic.pageElements.inputDelimiter.on("focus", function(){
			$(this).select();
		});
		ListMagic.pageElements.inputDelimiter.on("keyup", function(){
			ListMagic.processRawToList();
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
		if(ListMagic.pageElements.inputText.val().length < ListMagic.config.inputTextMinLength) {
			return;
		}
		
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

		
		// Output text to textarea
		ListMagic.pageElements.textareaText.val(ListMagic.variables.itemsList.join("\n"));
	},
	processListToRaw: ()=>{

	},
	autodetectDelimiter: (text)=>{
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


		// check if custom delimiter set, otherwise use default behaviour
		if(ListMagic.pageElements.inputSwitchCustomDelimiter.is(":checked")){
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
