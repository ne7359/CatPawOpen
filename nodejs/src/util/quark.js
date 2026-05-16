//jiami-mark
import req from './req.js';
import chunkStream  from './chunk.js';
import CryptoJS from 'crypto-js';
import { findBestLCS, delay} from './misc.js';
import {videosHandle} from "./utils.js";
import {isQuarkLink} from "./linkDetect.js";

export function getShareData(url) {
    let regex = /https:\/\/pan\.quark\.cn\/s\/([^\\|#/]+)/;
    let matches = regex.exec(url);
    if (matches) {
        return {
            shareId: matches[1],
            folderId: '0',
        };
    }
    return null;
}

const pr = 'pr=ucpro&fr=pc';

export const baseHeader = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) quark-cloud-drive/2.5.20 Chrome/100.0.4896.160 Electron/18.3.5.4-b478491100 Safari/537.36 Channel/pckk_other_ch',
    Referer: 'https://pan.quark.cn',
};

let localDb = null;
let ckey = null;

const apiUrl = 'https://drive.quark.cn/1/clouddrive/';
export let cookie = '5a147907-36f1-5df1-f29d-bd5b89fb7bd7; _UP_A4A_11_=wba2b19b65e942d399ad936f1f4b3f0b; isg=BENDlGDuLmncd-IdvU7T5QmT0gftuNf6F3VZtHUg86IZNGJW_Y4pS-ltqsR6lC_y; tfstk=gm6EmUZxHJeFmEzc0ivz_64XqN9pzLzX-TTWqgjkAeYHFWCP_gs4v3_CqU5ySgLHxYcnaVxCuDD32Yxy7FbGAvTWKUmPPg1CzgEpqUblzU1Q1-sdvLpulT2bhMEXvawlzBxkIhj9mXcu1Bxoe1WulrwbCWmMUyzfAPmTJdxJSHxkrXqwI3KyEHAHrl8M4nho-avubl-p02cnKBDiI3LMrLvlrGqw2FxkELbljl--HB7lJA8wtk5w8maEqYf2oMYZExovYBX3HFDoEO-FbEjhjYDlQHRFQknq1XdCZidAdtyrBpsVsdxVnzhyP9sfFdvzQqY1pi1vM9EmcFXCqtLCKPMB-9CNGQ5LujQ2LaRcKCooEGJPOd-GnuGv5O8Cr9RgcxRWItODK1NTRQ9e0aXd80kloGsfpCBzuVYROnpM0t4-aU6CcT9MngSZyhbjfTCErbRHXh8bbluUO6a4-kyfPbhJ_5KwloExwbdHXh8bbll-wCW9bEZYD; _UP_F7E_8D_=%2BayopBMZQEeTtrTZxwaYXksem8D%2BGJzLUdRO7YsGUI%2BibipNZ4wWoKA3nkVDHeUjK77U6xYgqMbXDik4ZZxmO%2B6jibaMeh%2F15GPrrCl5M87ivs0EP%2FjAQTQimMgEdat62Byd22%2BZGM54J%2Fziptn9u2cfCxE%2FEQoJ%2BNpGbi5CxruFaOJeIxsOpj2rgCrDRJ4%2F04Qd0TCOkGEoX6rztcHBVitCQ0ZajuT%2BUGLM2XwLq3bxPKpxB1MzLCuhzYy3fxfQ%2B%2BzgtF9v%2FpllrrcF3WtUYl8khMPKA1LxwEr4ZS6WLsWIA0YR4CKmB8OK2vmx6l2d%2F5hjcX%2BO%2Fr2gCph%2BlEs5eKz7FNe2w3pyuJ7p538z4EzaQ9dUDed1mOw0a4CyDOb2rtqa6biFodZb%2BpEomuVdoA%3D%3D; _UP_D_=pc; __pus=6cc430a40963a637969933619c5cd236AAQCu8nRSmf2t3/8AsKN8MS1G4U8+DSoQg1EyOgxAyW5RQpUssmNIa5WR0o6jdyc97V/fDyyRp2i8oNDQUz8+IM0; __kp=3cd4b9d0-5125-11f1-bb48-dd9f2483cf70; __kps=AATNq11InqwCKRtVaOo9rTh9; __ktd=YvUda3Cgddj2oMXxLpycOQ==; __uid=AATNq11InqwCKRtVaOo9rTh9; __puus=9836f0d074cecd5a5c91d08508a734a1AARnNnNrZLhd6Lt3gs3QlcUhP0YPbkao8THkk90EZkRa1kHQwgOJv+PYWvd/vQX/6EvncbyqIizXps1jORj2Vszo89dmUxOie2hydYUKjw57/JoKeXHC1JoukKZ8yPq24evkh0Ixuz9pjSTE9EFy/LGoTeGXoQbmYIWHpJxm4QBXGT2TI2jYRa021Q3Kou++xKP94NSRlzFH+3fX7RcdOZI9';

const shareTokenCache = {};
const saveDirName = 'CatVodOpen';
let saveDirId = null;

export async function initQuark(inReq) {
    localDb = inReq.server.db;
    const cfg = inReq.server.config.quark
    cookie = cfg.cookie;
    ckey = CryptoJS.enc.Hex.stringify(CryptoJS.MD5(cfg.cookie)).toString();
    const localCfg = await localDb.getObjectDefault(`/quark`, {});
    if (localCfg[ckey]) {
        cookie = localCfg[ckey];
    }
}

async function api(url, data, headers, method, retry) {
    headers = headers || {};
    Object.assign(headers, baseHeader);
    Object.assign(headers, {
        Cookie: cookie || '',
    });
    method = method || 'post';
    const resp =
        method == 'get'
            ? await req
                  .get(`${apiUrl}/${url}`, {
                      headers: headers,
                  })
                  .catch((err) => {
                      console.error(err);
                      if (err?.response?.status === 401) {
                          messageToDart({
                              action: 'toast',
                              opt: {
                                  message: '夸克token已过期，请前往【配置】站源进行配置',
                                  duration: 5
                              }
                          })
                      }
                      return err.response || { status: 500, data: {} };
                  })
            : await req
                  .post(`${apiUrl}/${url}`, data, {
                      headers: headers,
                  })
                  .catch((err) => {
                      console.error(err);
                      if (err?.response?.status === 401) {
                          messageToDart({
                              action: 'toast',
                              opt: {
                                  message: '夸克token已过期，请前往【配置】站源进行配置',
                                  duration: 5
                              }
                          })
                      }
                      return err.response || { status: 500, data: {} };
                  });
    const leftRetry = retry || 3;
    if (resp.headers['set-cookie']) {
        const puus = resp.headers['set-cookie'].join(';;;').match(/__puus=([^;]+)/);
        if (puus) {
            if (cookie.match(/__puus=([^;]+)/)[1] != puus[1]) {
                cookie = cookie.replace(/__puus=[^;]+/, `__puus=${puus[1]}`);
                await localDb.push(`/quark/${ckey}`, cookie);
            }
        }
    }
    if (resp.status === 429 && leftRetry > 0) {
        await delay(1000);
        return await api(url, data, headers, method, leftRetry - 1);
    }
    return resp.data || {};
}

async function clearSaveDir() {
    const listData = await api(`file/sort?${pr}&pdir_fid=${saveDirId}&_page=1&_size=200&_sort=file_type:asc,updated_at:desc`, {}, {}, 'get');
    if (listData.data && listData.data.list && listData.data.list.length > 0) {
        const del = await api(`file/delete?${pr}`, {
            action_type: 2,
            filelist: listData.data.list.map((v) => v.fid),
            exclude_fids: [],
        });
        console.log(del);
    }
}

async function createSaveDir(clean) {
    if (saveDirId) {
        // 删除所有子文件
        if (clean) await clearSaveDir();
        return;
    }
    const listData = await api(`file/sort?${pr}&pdir_fid=0&_page=1&_size=200&_sort=file_type:asc,updated_at:desc`, {}, {}, 'get');
    if (listData.data && listData.data.list)
        for (const item of listData.data.list) {
            if (item.file_name === saveDirName) {
                saveDirId = item.fid;
                await clearSaveDir();
                break;
            }
        }
    if (!saveDirId) {
        const create = await api(`file?${pr}`, {
            pdir_fid: '0',
            file_name: saveDirName,
            dir_path: '',
            dir_init_lock: false,
        });
        console.log(create);
        if (create.data && create.data.fid) {
            saveDirId = create.data.fid;
        }
    }
}

async function getShareToken(shareData) {
    if (!shareTokenCache[shareData.shareId]) {
        delete shareTokenCache[shareData.shareId];
        const shareToken = await api(`share/sharepage/token?${pr}`, {
            pwd_id: shareData.shareId,
            passcode: shareData.sharePwd || '',
        });
        if (shareToken.data && shareToken.data.stoken) {
            shareTokenCache[shareData.shareId] = shareToken.data;
        }
    }
}

const subtitleExts = ['.srt', '.ass', '.scc', '.stl', '.ttml'];

export async function getFilesByShareUrl(shareInfo) {
    const shareData = typeof shareInfo === 'string' ? getShareData(shareInfo) : shareInfo;
    if (!shareData) return [];
    await getShareToken(shareData);
    if (!shareTokenCache[shareData.shareId]) return [];
    const videos = [];
    const subtitles = [];
    const listFile = async function (shareId, folderId, page) {
        const prePage = 100;
        page = page || 1;
        const listData = await api(`share/sharepage/detail?${pr}&pwd_id=${shareId}&stoken=${encodeURIComponent(shareTokenCache[shareId].stoken)}&pdir_fid=${folderId}&force=0&_page=${page}&_size=${prePage}&_sort=file_type:asc,file_name:asc`, {}, {}, 'get');
        if (!listData.data) return [];
        const items = listData.data.list;
        if (!items) return [];
        const subDir = [];

        for (const item of items) {
            if (item.dir === true) {
                subDir.push(item);
            } else if (item.file === true && item.obj_category === 'video') {
                if (item.size < 1024 * 1024 * 5) continue;
                item.stoken = shareTokenCache[shareData.shareId].stoken;
                videos.push(item);
            } else if (item.type === 'file' && subtitleExts.some((x) => item.file_name.endsWith(x))) {
                subtitles.push(item);
            }
        }

        if (page < Math.ceil(listData.metadata._total / prePage)) {
            const nextItems = await listFile(shareId, folderId, page + 1);
            for (const item of nextItems) {
                items.push(item);
            }
        }

        for (const dir of subDir) {
            const subItems = await listFile(shareId, dir.fid);
            for (const item of subItems) {
                items.push(item);
            }
        }

        return items;
    };
    await listFile(shareData.shareId, shareData.folderId);
    if (subtitles.length > 0) {
        videos.forEach((item) => {
            var matchSubtitle = findBestLCS(item, subtitles);
            if (matchSubtitle.bestMatch) {
                item.subtitle = matchSubtitle.bestMatch.target;
            }
        });
    }

    return videos;
}

const saveFileIdCaches = {};

async function save(shareId, stoken, fileId, fileToken, clean) {
    await createSaveDir(clean);
    if (clean) {
        const saves = Object.keys(saveFileIdCaches);
        for (const save of saves) {
            delete saveFileIdCaches[save];
        }
    }
    if (!saveDirId) return null;
    if (!stoken) {
        await getShareToken({
            shareId: shareId,
        });
        if (!shareTokenCache[shareId]) return null;
    }
    const saveResult = await api(`share/sharepage/save?${pr}`, {
        fid_list: [fileId],
        fid_token_list: [fileToken],
        to_pdir_fid: saveDirId,
        pwd_id: shareId,
        stoken: stoken || shareTokenCache[shareId].stoken,
        pdir_fid: '0',
        scene: 'link',
    });
    if (saveResult.data && saveResult.data.task_id) {
        let retry = 0;
        // wait task finish
        while (true) {
            const taskResult = await api(`task?${pr}&task_id=${saveResult.data.task_id}&retry_index=${retry}`, {}, {}, 'get');
            if (taskResult.data && taskResult.data.save_as && taskResult.data.save_as.save_as_top_fids && taskResult.data.save_as.save_as_top_fids.length > 0) {
                return taskResult.data.save_as.save_as_top_fids[0];
            }
            retry++;
            if (retry > 5) break;
            await delay(1000);
        }
    }
    return false;
}

export async function getLiveTranscoding(shareId, stoken, fileId, fileToken) {
    if (!saveFileIdCaches[fileId]) {
        const saveFileId = await save(shareId, stoken, fileId, fileToken, true);
        if (!saveFileId) return null;
        saveFileIdCaches[fileId] = saveFileId;
    }
    const transcoding = await api(`file/v2/play?${pr}`, {
        fid: saveFileIdCaches[fileId],
        resolutions: 'normal,low,high,super,2k,4k',
        supports: 'fmp4',
    });
    if (transcoding.data && transcoding.data.video_list) {
        return transcoding.data.video_list;
    }
    return null;
}

export async function getDownload(shareId, stoken, fileId, fileToken, clean) {
    if (!saveFileIdCaches[fileId]) {
        const saveFileId = await save(shareId, stoken, fileId, fileToken, clean);
        if (!saveFileId) return null;
        saveFileIdCaches[fileId] = saveFileId;
    }
    const down = await api(`file/download?${pr}`, {
        fids: [saveFileIdCaches[fileId]],
    });
    if (down.data) {
        return down.data[0];
    }
    return null;
}

export async function detail(shareUrl) {
    if (isQuarkLink('https://pan.quark.cn')) {
        const shareData = getShareData(shareUrl);
        if (shareData) {
            let videos = await getFilesByShareUrl(shareData);
            videos = videos.map(v => {
                const ids = [shareData.shareId, v.stoken, v.fid, v.share_fid_token, v.subtitle ? v.subtitle.fid : '', v.subtitle ? v.subtitle.share_fid_token : ''];
                return {
                    vod_id: ids.join('*'),
                    vod_name: v.file_name,
                    vod_size: v.size,
                }
            })
            return videosHandle(getPanName('quark') + '-' + shareData.shareId, videos)
        } else {
            return {}
        }
    }
}

const quarkTranscodingCache = {};
const quarkDownloadingCache = {};

export async function proxy(inReq, outResp) {
    await initQuark(inReq)
    const site = inReq.params.site;
    const what = inReq.params.what;
    const shareId = inReq.params.shareId;
    const fileId = inReq.params.fileId;
    if (site == 'quark') {
        let downUrl = '';
        const ids = fileId.split('*');
        const flag = inReq.params.flag;
        if (what == 'trans') {
            if (!quarkTranscodingCache[ids[1]]) {
                quarkTranscodingCache[ids[1]] = (await getLiveTranscoding(shareId, decodeURIComponent(ids[0]), ids[1], ids[2])).filter((t) => t.accessable);
            }
            downUrl = quarkTranscodingCache[ids[1]].filter((t) => t.resolution.toLowerCase() == flag)[0].video_info.url;
            outResp.redirect(downUrl);
            return;
        } else {
            if (!quarkDownloadingCache[ids[1]]) {
                const down = await getDownload(shareId, decodeURIComponent(ids[0]), ids[1], ids[2], flag == 'down');
                if (down) quarkDownloadingCache[ids[1]] = down;
            }
            downUrl = quarkDownloadingCache[ids[1]].download_url;
            if (flag == 'redirect') {
                outResp.redirect(downUrl);
                return;
            }
        }
        return await chunkStream(
            inReq,
            outResp,
            downUrl,
            ids[1],
            Object.assign(
                {
                    Cookie: cookie,
                },
                baseHeader,
            ),
        );
    }
}

export async function play(inReq, outResp) {
    await initQuark(inReq)
    const flag = inReq.body.flag;
    const id = inReq.body.id;
    const ids = id.split('*');
    let idx = 0;
    if (flag.startsWith(getPanName('quark'))) {
        const transcoding = (await getLiveTranscoding(ids[0], ids[1], ids[2], ids[3])).filter((t) => t.accessable);
        quarkTranscodingCache[ids[2]] = transcoding;
        const urls = [];
        const p= ['超清','蓝光','高清','标清','普画','极速'];
        const arr =['4k','2k','super','high','low','normal'];
        const proxyUrl = inReq.server.address().url + inReq.server.prefix + '/proxy/quark';
        urls.push('代理');
        urls.push(`${proxyUrl}/src/down/${ids[0]}/${encodeURIComponent(ids[1])}*${ids[2]}*${ids[3]}/.bin`);
        urls.push('原画');
        urls.push(`${proxyUrl}/src/redirect/${ids[0]}/${encodeURIComponent(ids[1])}*${ids[2]}*${ids[3]}/.bin`);
        const result = {
            parse: 0,
            url: urls,
            header: Object.assign(
                {
                    Cookie: cookie,
                },
                baseHeader,
            ),
        };
        if (ids[3]) {
            result.extra = {
                subt: `${proxyUrl}/src/subt/${ids[0]}/${encodeURIComponent(ids[1])}*${ids[4]}*${ids[5]}/.bin`,
            };
        }
        transcoding.forEach((t) => {
            idx = arr.indexOf(t.resolution);
            urls.push(p[idx]);
            urls.push(`${proxyUrl}/trans/${t.resolution.toLowerCase()}/${ids[0]}/${encodeURIComponent(ids[1])}*${ids[2]}*${ids[3]}/.mp4`);
        });
        return result;
    }
}
