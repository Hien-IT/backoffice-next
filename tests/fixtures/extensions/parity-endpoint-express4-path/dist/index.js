var a={id:"parity-endpoint-express4-path",handler:a=>{a.get("/optional/:id?",(a,e)=>e.json({id:a.params.id??null})),a.get("/wild/*",(a,e)=>e.json({rest:a.params[0]??null}))}};export{a as default};
