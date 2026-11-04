import{log as o}from"directus:api";var a=a=>{a.get("/",async()=>(o("parity-upload-endpoint: hello"),{status:200,body:{ok:!0,source:"upload"}}))};export{a as default};
