export const fieldOrder:Array<string> = 
["title",
"id" , 
"related", 
"status", 
"description",
"references",
"author",
"date",
"modified",
"tags",
"logsource",
"detection",
"condition",
"fields", 
"falsepositives", 
"level"];


export const subFieldOrderLogSource:Array<string> =[
    "category",
    "product", 
    "service",
    "definition"
];

module.exports = {fieldOrder,subFieldOrderLogSource};