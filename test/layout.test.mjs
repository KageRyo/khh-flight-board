import {test} from 'node:test';
import assert from 'node:assert/strict';
import {layout} from '../public/config.mjs';
test('航班列數使用實際可用高度，1080p、4K、手機與警示列皆不截斷最後一列',()=>{
  for(const [w,h,available,panels] of [[1920,1080,807,2],[3840,2160,1614,2],[390,844,500,1],[1920,1080,760,2]]){
    const m=layout(w,h,true,available),rowHeight=Math.max(34,Math.min(110,h*.044)),head=h*(w<1000?.05:.06);
    assert.equal(m.panels,panels);assert.ok(m.rowCount*rowHeight+head<=available);assert.equal(m.capacity,m.rowCount*panels);
  }
});
