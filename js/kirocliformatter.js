let KiroCliFormatter = {
	name: "KiroCliFormatter",
	friendlyName: "Kiro-CLI Formatter",
	pageElements: {
		h2Title: $("#h2_title"),
		textareaInput: $("#textarea_input"),
		textareaOutput: $("#textarea_output")
	},
	load: () => {
		// Update SPA
		SPA.variables.currentPageObject = KiroCliFormatter;

		// Register listeners
		KiroCliFormatter.pageElements.textareaInput.on("keyup", KiroCliFormatter.processInput);

		// Format any pre-filled input without requiring a keypress
		KiroCliFormatter.processInput();

		// Ready
		CommonHelpers.logger.info("loaded successfully", KiroCliFormatter.name);
	},
	destroy: () => {
		KiroCliFormatter = null;
	},

	// Page specific functions below this line
	// ---------------------------––––--------
	processInput: () => {
		const input = KiroCliFormatter.pageElements.textareaInput.val();
		try {
			const output = KiroCliFormatter.format(input);
			KiroCliFormatter.pageElements.textareaOutput.val(output);
		} catch (e) {
			CommonHelpers.logger.info(e.message, KiroCliFormatter.name);
		}
	},
	format: (input) => {
		if (typeof input !== "string") return "";
		const lines = input.split(/\r\n|\r|\n/);
		const stripped = lines.map(line => line.replace(/^[ \t]+/, ""));
		const joined = stripped.join(" ");
		const withParagraphBreaks = joined.replace(/  /g, "\n\n");
		// Collapse any trailing whitespace after a newline (e.g. "\n " or "\n\t") into a plain newline
		return withParagraphBreaks.replace(/\n[ \t]+/g, "\n");
	}
};

KiroCliFormatter.load();
