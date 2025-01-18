import {request, post, mergeQuery} from '../../util/request.js';
import {base64Encode, md5} from '../../util/crypto-util.js';
import * as cfg from '../../index.config.js';

const sitesCache = new Map();
// const SKEY = md5('nodejs_drpyS');
const SKEY = md5('4');
const API = cfg.default.drpyS.home_site;
sitesCache.set(SKEY, {
    api: API,
    extend: '',
});

function getSiteUrl(skeyHash) {
    const site = sitesCache.get(skeyHash);
    let url = site.api;
    if (site.extend) {
        url = mergeQuery(url, {extend: site.extend});
    }
    return url
}

function updateSiteMap(sites) {
    sites.forEach((site) => {
        let skeyHash = md5(site.key);
        sitesCache.set(skeyHash, Object.assign(sitesCache.get(skeyHash) || {}, {
            api: site.ext.api,
            extend: site.ext.extend,
        }));
    });
}

async function support(_inReq, _outResp) {
    // const clip = inReq.body.clip;
    const prefix = _inReq.server.prefix;
    const skey = prefix.slice(prefix.lastIndexOf('/') + 1);
    if (skey === 'push') {
        return 'true';
    }
    return 'false'
}

async function init(_inReq, _outResp) {
    const {ext, skey, stype} = _inReq.body;
    const skeyHash = md5(skey);
    console.log('ext:', ext);
    console.log('skey:', skey);
    console.log('stype:', stype);
    if (sitesCache.has(skeyHash)) {
        const cached = sitesCache.get(skeyHash);
        console.log('已储存:', cached);
        return cached
    }
    const storeSites = {
        api: ext.api,
        extend: ext.ext,
    }
    sitesCache.set(skeyHash, storeSites);
    console.log('未储存:', storeSites);
    return storeSites
}

async function home(_inReq, _outResp) {
    const prefix = _inReq.server.prefix;
    const skeyHash = md5(prefix.slice(prefix.lastIndexOf('/') + 1));
    let url = getSiteUrl(skeyHash);
    const result = await request(url);
    const site = sitesCache.get(skeyHash);
    if (result.list.length > 0 && Array.isArray(result['class'])) {
        site['home_videos'] = result.list;
        result['class'].unshift({"type_name": "推荐", "type_id": "dsHome"},)
    }
    sitesCache.set(skeyHash, site);
    return result
}

async function category(_inReq, _outResp) {
    const prefix = _inReq.server.prefix;
    const skeyHash = md5(prefix.slice(prefix.lastIndexOf('/') + 1));
    let url = getSiteUrl(skeyHash);
    const tid = _inReq.body.id;
    const pg = _inReq.body.page || 1;
    if (tid === 'dsHome') {
        if (pg === 1) {
            const site = sitesCache.get(skeyHash);
            return {list: site['home_videos']}
        } else {
            return {list: []}
        }
    }
    const filters = _inReq.body.filters || {};
    let ext = undefined;
    if (Object.keys(filters).length > 0) {
        ext = base64Encode(JSON.stringify(filters));
    }
    const query = {
        ac: 'list',
        t: tid,
        pg: pg,
        ext: ext,
    }
    url = mergeQuery(url, query);
    const result = await request(url);
    return result;
}

async function detail(_inReq, _outResp) {
    const prefix = _inReq.server.prefix;
    const skeyHash = md5(prefix.slice(prefix.lastIndexOf('/') + 1));
    let url = getSiteUrl(skeyHash);
    const ids = !Array.isArray(_inReq.body.id) ? [_inReq.body.id] : _inReq.body.id;

    const query = {ac: 'detail', ids: ids.join(',')};
    url = mergeQuery(url, query);
    const result = await request(url);
    // const data = {ac: 'detail', ids: ids.join(',')};
    // const result = await post(url, data);
    if (result.list && Array.isArray(result.list)) {
        const vod_play_url = result.list[0].vod_play_url;
        // 手动处理push:// 调用push_agent
        if (vod_play_url && vod_play_url.includes('push://')) {
            console.log('vod_play_url:', vod_play_url);
            let vod_play_urls = [];
            let vod_play_froms = result.list[0].vod_play_from.split('$$$');
            let vod_play_arr = vod_play_url.split('$$$');
            for (let i in vod_play_arr) {
                const play_url = vod_play_url[i];
                if (play_url.includes('push://')) {
                    const tab_urls = play_url.split('#');
                    let _vod_play_urls = [];
                    for (const tab_url of tab_urls) {
                        let _title = tab_url.split('$')[0];
                        let vod_url = tab_url.split('$')[1];
                        if (vod_url && vod_url.startsWith('push://')) {
                            let _ids = vod_url.slice(7);
                            let _url = getSiteUrl(md5('push_agent'));


                            // let _data = {ac: 'detail', ids: _ids};
                            // let _result = await post(_url, _data);

                            const _query = {ac: 'detail', ids: _ids};
                            _url = mergeQuery(_url, _query);
                            const _result = await request(_url);

                            if (_result && Array.isArray(_result.list)) {
                                let _vod_play_url = _result.list[0].vod_play_url;
                                vod_play_froms[i] = _result.list[0].vod_play_from;
                                _vod_play_urls = _vod_play_urls.concat(_vod_play_url.split('#').map(i => i.replace('$', '$push://')).join('#'));
                            }
                        } else {
                            _vod_play_urls.push(tab_url)
                        }
                    }
                    vod_play_urls.push(_vod_play_urls.join('#'));
                } else {
                    vod_play_urls.push(play_url)
                }
            }
            result.list[0].vod_play_url = vod_play_urls.join('$$$');
            result.list[0].vod_play_from = vod_play_froms.join('$$$');
        }
    }
    return result;
}


async function play(_inReq, _outResp) {
    const prefix = _inReq.server.prefix;
    const skeyHash = md5(prefix.slice(prefix.lastIndexOf('/') + 1));
    let url = getSiteUrl(skeyHash);
    let id = _inReq.body.id;
    if (id && id.startsWith('push://')) {
        url = getSiteUrl(md5('push_agent'));
        id = id.slice(7);
    }

    const flag = _inReq.body.flag;
    const flags = _inReq.body.flags;
    const query = {play: `${id}`, flag: flag};
    url = mergeQuery(url, query);
    const result = await request(url);
    return result;
}

async function search(_inReq, _outResp) {
    const prefix = _inReq.server.prefix;
    const skeyHash = md5(prefix.slice(prefix.lastIndexOf('/') + 1));
    let url = getSiteUrl(skeyHash);
    const wd = _inReq.body.wd;
    const pg = Number(_inReq.body.page) || 1;
    const quick = _inReq.body.quick || undefined;
    const query = {wd: wd, pg: pg, quick: quick};
    url = mergeQuery(url, query);

    const result = await request(url);
    return result;
}

async function test(_inReq, _outResp) {
    try {
        const printErr = function (json) {
            if (json.statusCode && json.statusCode == 500) {
                console.error(json);
            }
        };
        const prefix = _inReq.server.prefix;
        const dataResult = {};
        const skey = prefix.slice(prefix.lastIndexOf('/') + 1);
        let resp = await _inReq.server.inject().post(`${prefix}/init`).payload({
            ext: {api: API, extend: ''}, skey, stype: 4
        });
        dataResult.init = resp.json();
        printErr(resp.json());
        resp = await _inReq.server.inject().post(`${prefix}/home`);
        dataResult.home = resp.json();
        printErr(resp.json());
        if (dataResult.home.class.length > 0) {
            resp = await _inReq.server.inject().post(`${prefix}/category`).payload({
                id: dataResult.home.class[0].type_id,
                page: 1,
                filter: true,
                filters: {},
            });
            dataResult.category = resp.json();
            printErr(resp.json());
            if (dataResult.category.list.length > 0) {
                resp = await _inReq.server.inject().post(`${prefix}/detail`).payload({
                    id: dataResult.category.list[0].vod_id, // dataResult.category.list.map((v) => v.vod_id),
                });
                dataResult.detail = resp.json();
                printErr(resp.json());
                if (dataResult.detail.list && dataResult.detail.list.length > 0) {
                    dataResult.play = [];
                    for (const vod of dataResult.detail.list) {
                        const flags = vod.vod_play_from.split('$$$');
                        const ids = vod.vod_play_url.split('$$$');
                        for (let j = 0; j < flags.length; j++) {
                            const flag = flags[j];
                            const urls = ids[j].split('#');
                            for (let i = 0; i < urls.length && i < 2; i++) {
                                resp = await _inReq.server
                                    .inject()
                                    .post(`${prefix}/play`)
                                    .payload({
                                        flag: flag,
                                        id: urls[i].split('$')[1],
                                    });
                                dataResult.play.push(resp.json());
                            }
                        }
                    }
                }
            }
        }
        resp = await _inReq.server.inject().post(`${prefix}/search`).payload({
            wd: '爱',
            page: 1,
        });
        dataResult.search = resp.json();
        printErr(resp.json());
        return dataResult;
    } catch (err) {
        console.error(err);
        _outResp.code(500);
        return {err: err.message, tip: 'check debug console output'};
    }
}

export default {
    meta: {
        key: 'drpyS',
        name: '道长DS',
        type: 7,
    },
    updateSiteMap,
    api: async (fastify) => {
        fastify.post('/support', support);
        fastify.post('/init', init);
        fastify.post('/home', home);
        fastify.post('/category', category);
        fastify.post('/detail', detail);
        fastify.post('/play', play);
        fastify.post('/search', search);
        fastify.get('/test', test);
    },
};