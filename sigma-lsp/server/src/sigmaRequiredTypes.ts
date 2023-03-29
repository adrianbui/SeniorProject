// required types for each sigma field according to https://github.com/SigmaHQ/sigma-specification/blob/main/Sigma_specification.md

export const requiredTypes = {
	"title": "string",
	"logsource": "object",
	"category": "string",
	"product": "string",
	"service": "string",
	"definition": "string",
	"detection": "object",
	"status": "string",
	"description": "string",
	"references": "array", // array of strings
	"author": "string",
	"date": "string",
	"modified": "string",
	"fields": "array", //array of strings
	// "falsepositives": ["array", "string"], // array or a string
	"level": "string",
	"tags": "array",
	"id": "string"
};

module.exports = {requiredTypes};
