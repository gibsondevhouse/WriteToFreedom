export const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});

export function isSameOriginJson(request,origin){
 return request.headers.get('origin')===origin&&request.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase()==='application/json';
}