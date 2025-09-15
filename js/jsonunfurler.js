let JsonUnfurler = {
	name: "JsonUnfurler",
	friendlyName: "JSON Unfurler",
	pageElements: {
		h2Title: $("#h2_title"),
		textareaInput: $("#textarea_input"),
		textareaOutput: $("#textarea_output"),
	},
	load: ()=>{
		// Update SPA
		SPA.variables.currentPageObject = JsonUnfurler;

		// Register listeners
		JsonUnfurler.pageElements.textareaInput.on("keyup", JsonUnfurler.processJson);
		JsonUnfurler.pageElements.textareaInput.on("change", JsonUnfurler.processJson);

		// Ready
		CommonHelpers.logger.info("loaded successfully", JsonUnfurler.name);
	},
	destroy: ()=>{
		JsonUnfurler = null;
	},

	// Page specific functions below this line
	// ---------------------------––––--------
	processJson: ()=>{
		const inputText = JsonUnfurler.pageElements.textareaInput.val().trim();
		
		if(inputText.length === 0) {
			JsonUnfurler.pageElements.textareaOutput.val("");
			return;
		}

		try {
			// Parse the JSON to validate and unescape
			let parsedJson = JSON.parse(inputText);
			
			// Recursively parse nested JSON strings
			parsedJson = JsonUnfurler.unfurlNestedJson(parsedJson);
			
			// Format with 4 spaces indentation
			const formattedJson = JSON.stringify(parsedJson, null, 4);
			
			JsonUnfurler.pageElements.textareaOutput.val(formattedJson);
		} catch (error) {
			JsonUnfurler.pageElements.textareaOutput.val("Input is not valid JSON");
		}
	},
	unfurlNestedJson: (obj)=>{
		if (typeof obj === 'string') {
			try {
				// Try to parse as JSON
				const parsed = JSON.parse(obj);
				// Recursively unfurl the parsed object
				return JsonUnfurler.unfurlNestedJson(parsed);
			} catch {
				// Not JSON, return as is
				return obj;
			}
		} else if (Array.isArray(obj)) {
			return obj.map(item => JsonUnfurler.unfurlNestedJson(item));
		} else if (obj !== null && typeof obj === 'object') {
			const result = {};
			for (const [key, value] of Object.entries(obj)) {
				result[key] = JsonUnfurler.unfurlNestedJson(value);
			}
			return result;
		}
		return obj;
	}
};

JsonUnfurler.load();