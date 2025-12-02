using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using RenderHeads.Media.AVProVideo;
using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;
using UnityEngine.UI;
using static APIManager.DeviceRegisterData;

public class APIManager : MonoBehaviour
{
    #region Variables --------------------------------------------------

    [Header("API URLs")]
    public string journeyApi;
    public string deviceRegisterApi;
    public string retrieveSessionApi;
    public string sessionLogApi;

    [Header("Identifiers")]
    public string vid;
    string deviceId;
    string deviceModel;
    string startTime;
    string endTime;

    public static APIManager Instance { get; private set; }

    private Dictionary<int, JourneyContent> journeyDataDict = new Dictionary<int, JourneyContent>();

    #endregion

    #region Data Structures --------------------------------------------

    [System.Serializable] public class ApiResponse { public bool status; public string message; public JourneyData[] data; }

    [System.Serializable]
    public class JourneyData
    {
        public int id;
        public string title;
        public string description;
        public JourneyVideoData video;
        public AudioTrack[] audio_tracks;
        public string[] audio_languages;
    }

    [System.Serializable]
    public class JourneyVideoData
    {
        public int id;
        public string title;
        public string description;
        public string url;
        public string thumbnail_url;
    }

    [System.Serializable]
    public class AudioTrack
    {
        public int id;
        public int journey_id;
        public string url;
        public string language_code;
    }

    [Serializable] public class JourneyResponse { public bool status; public JourneySessionData data; }

    [Serializable]
    public class JourneySessionData
    {
        public string id;
        public string vr_device_id;
        public string chair_device_id;
        public string status;
        public string overall_status;
        public string group_id;
        public int[] journey_ids;
        public string session_type;
        public VRDevice[] vr;
        public ChairDevice[] chair;
        public JourneyWrapper[] journeys;
        public Participant[] participants;
    }

    [Serializable]
    public class JourneyContent
    {
        public int journeyId;
        public string videoUrl;
        public string videoTitle;
        public string videoDesc;
        public string[] audioUrls;
        public string[] audioLangs;
    }

    [Serializable] public class VRDevice { public string id; public string deviceId; }
    [Serializable] public class ChairDevice { public string id; public string deviceId; }

    [Serializable] public class Metadata { public string fw; public string model; }

    [Serializable]
    public class JourneyWrapper
    {
        public JourneyDetail journey;
        public VideoData video;
        public TelemetryData telemetry;
    }

    [Serializable]
    public class JourneyDetail
    {
        public int id;
        public string title;
        public string description;
        public int video_id;
        public int? audio_track_id;
        public int telemetry_id;
        public AudioTrackWrapper[] audio_tracks;
    }

    [Serializable]
    public class AudioTrackWrapper
    {
        public int id;
        public int journey_id;
        public int audio_track_id;
        public string audio_url;
        public int order_index;
        public string title;
        public AudioTrackDetail audio_track;
    }

    [Serializable]
    public class AudioTrackDetail
    {
        public int id;
        public string language_code;
        public string audio_url;
        public string mime_type;
    }

    [Serializable]
    public class VideoData
    {
        public int id;
        public string title;
        public string description;
        public float duration_ms;
        public string video_url;
        public string mime_type;
        public string thumbnail_url;
        public string url;
    }

    [Serializable]
    public class TelemetryData
    {
        public int id;
        public string telemetry_url;
        public string version;
        public string format;
        public string url;
    }

    [Serializable]
    public class Participant
    {
        public string id;
        public string session_id;
        public string vr_device_id;
        public string chair_device_id;
        public string participant_code;
        public string language;
        public string joined_at;
        public string left_at;
        public string status;
        public string notes;
        public float? sync_ok_rate;
        public float? avg_drift_ms;
        public float? max_drift_ms;
        public string createdAt;
        public string updatedAt;
        public VRDevice vr;
        public ChairDevice chair;
    }

    [System.Serializable]
    public class DeviceRegister
    {
        public string type;
        public string bundleCode;
        public string deviceId;
        public MetaData metadata;

        [System.Serializable]
        public class MetaData { public string model; public string fw; }

        public DeviceRegister(string type, string code, string deviceId, string model, string fw)
        {
            this.type = type;
            this.bundleCode = code;
            this.deviceId = deviceId;
            metadata = new MetaData { model = model, fw = fw };
        }
    }

    [System.Serializable] public class DeviceRegisterResponse { public bool status; public DeviceRegisterData data; }

    [System.Serializable]
    public class DeviceRegisterData
    {
        public string id;
        public string deviceId;
        public string registeredAt;
        public MetaData metadata;
        public string lastSeenAt;
        public string createdAt;
        public string updatedAt;

        [System.Serializable] public class MetaData { public string model; public string fw; }

        [System.Serializable] public class SessionResponse { public bool status; public SessionData data; }

        [System.Serializable]
        public class SessionData { public string id; public JourneyWrapper[] journeys; }

        [System.Serializable]
        public class JourneyWrapper
        {
            public JourneyDetail journey;
            public VideoDetail video;
        }

        [System.Serializable]
        public class JourneyDetail
        {
            public int id;
            public string title;
            public string description;
            public AudioTrackWrapper[] audio_tracks;
        }

        [System.Serializable]
        public class AudioTrackWrapper { public int id; public AudioTrackInner audio_track; }

        [System.Serializable]
        public class AudioTrackInner { public string language_code; public string audio_url; }

        [System.Serializable]
        public class VideoDetail { public int id; public string title; public string description; public string url; }
    }

    [System.Serializable]
    public class DeviceRegisterResponsee
    {
        public bool status;
        public Data data;
    }

    [System.Serializable]
    public class Data
    {
        public Device device;
        public Bundle bundle;
        public string pair; // MUST be string or a class, NOT object
    }

    [System.Serializable]
    public class Device
    {
        public string id;
        public string deviceId;
        public string registeredAt;
        public Metadata metadata;
        public string lastSeenAt;
        public string createdAt;
        public string updatedAt;
    }

    [System.Serializable]
    public class Bundle
    {
        public string id;
        public string code;
        public string expiresAt;
        public string vr_device_id;
        public string chair_device_id;
        public bool completed;
        public string completedAt;
        public string target_pair_id;
        public string createdAt;
        public string updatedAt;
    }

    #endregion

    #region Unity Lifecycle --------------------------------------------

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
    }

    public void Start()
    {
        sessionLogApi = GameManager.Instance._IP + sessionLogApi;
        retrieveSessionApi = GameManager.Instance._IP + retrieveSessionApi;
        deviceRegisterApi = GameManager.Instance._IP + deviceRegisterApi;
        journeyApi = GameManager.Instance._IP + journeyApi;

        vid = PlayerPrefs.GetString("VR_ID", "");
        StartTime();

        StartCoroutine(GetJourneyAPI());
        if (!string.IsNullOrEmpty(vid))
        {
            GameManager.Instance.mqtt.gameObject.SetActive(true);
            //GameManager.Instance.mqtt.Connect();
        }
        else
        {
            GameManager.Instance.AVProParent.SetActive(false);
            GameManager.Instance.Environment.SetActive(true);
            GameManager.Instance._NSCUIParent.SetActive(false);
            GameManager.Instance.adminPanel.SetActive(true);
            GameManager.Instance.numPad.SetActive(true);
            GameManager.Instance.numPadParent.SetActive(true);
            GameManager.Instance.deviceIDManager.deviceIdInputText.text = "";
        }
    }

    private void Update()
    {
        // Optional debug triggers
        // if (Input.GetKeyDown(KeyCode.B)) StartCoroutine(PostSessionId());
    }

    #endregion

    #region API: Individual User Journey -----------------------------------------------

    private IEnumerator GetJourneyAPI()
    {
        UnityWebRequest req = new UnityWebRequest(journeyApi, "GET");
        req.downloadHandler = new DownloadHandlerBuffer();
        req.SetRequestHeader("Content-Type", "application/json");
        req.certificateHandler = new BypassCertificateHandler();

        yield return req.SendWebRequest();

        if (req.result != UnityWebRequest.Result.Success)
        {
            Debug.LogError("API Error: " + req.error);
            yield break;
        }

        string jsonData = req.downloadHandler.text;
        ApiResponse response = JsonConvert.DeserializeObject<ApiResponse>(jsonData);

        if (response.status && response.data.Length > 0)
        {
            GameManager.Instance.videoTitle.Clear();
            GameManager.Instance.videoDesc.Clear();
            GameManager.Instance.videoUserSprites.Clear();
            GameManager.Instance.videoUrlList.Clear();
            GameManager.Instance.expAudioUrlList.Clear();
            GameManager.Instance.expAudioLangList.Clear();
            GameManager.Instance.videoJourneyIds.Clear();

            foreach (var journey in response.data)
            {
                if (journey.video != null)
                {
                    GameManager.Instance.videoTitle.Add(journey.video.title);
                    GameManager.Instance.videoDesc.Add(journey.video.description);
                    GameManager.Instance.videoUserSprites.Add(null);
                    GameManager.Instance.videoUrlList.Add(journey.video.url);
                    GameManager.Instance.videoThumbnailUrlList.Add(journey.video.thumbnail_url);
                    GameManager.Instance.videoJourneyIds.Add(journey.id.ToString());
                }

                List<string> audioUrls = new List<string>();
                List<string> audioLangs = new List<string>();

                if (journey.audio_tracks != null)
                {
                    foreach (var track in journey.audio_tracks)
                    {
                        audioUrls.Add(track.url);
                        audioLangs.Add(track.language_code);
                    }
                }

                GameManager.Instance.expAudioUrlList.Add(audioUrls);
                GameManager.Instance.expAudioLangList.Add(audioLangs);
            }

            GameManager.Instance.videoButtonCount = response.data.Length;

            if (DynamicButtonController.Instance != null)
                DynamicButtonController.Instance.StartAssign();
        }
    }

    #endregion

    #region API: Device Register ---------------------------------------

    public IEnumerator PostDeviceRegister(bool isStart)
    {
        GameManager.Instance.isStart = isStart;

         deviceId = SystemInfo.deviceUniqueIdentifier;

        deviceModel = SystemInfo.deviceModel;
        string fw = SystemInfo.operatingSystem;
        string savedDeviceId = PlayerPrefs.GetString("devicecodeid", "");

        if (string.IsNullOrEmpty(savedDeviceId))
        {
            Debug.LogWarning("Device ID is empty. Cannot submit.");
            GameManager.Instance.AVProParent.SetActive(false);
            GameManager.Instance.Environment.SetActive(true);
            GameManager.Instance._NSCUIParent.SetActive(false);
            GameManager.Instance.adminPanel.SetActive(true);
            GameManager.Instance.numPad.SetActive(true);
            GameManager.Instance.numPadParent.SetActive(true);
            GameManager.Instance.deviceIDManager.deviceIdInputText.text = "";
            yield break;
        }

        DeviceRegister body = new DeviceRegister("vr", savedDeviceId, deviceId, deviceModel, fw);
        string jsonBody = JsonUtility.ToJson(body);

        UnityWebRequest req = new UnityWebRequest(deviceRegisterApi, "POST");
        req.uploadHandler = new UploadHandlerRaw(System.Text.Encoding.UTF8.GetBytes(jsonBody));
        req.downloadHandler = new DownloadHandlerBuffer();
        req.SetRequestHeader("Content-Type", "application/json");
        req.certificateHandler = new BypassCertificateHandler();

        yield return req.SendWebRequest();

        string responseText = req.downloadHandler.text;
        JObject jObj = JObject.Parse(responseText);

        if (!(bool)jObj["status"])
        {
            string msg = (string)jObj["message"];
            if (msg == "Code already used")
            {
                Debug.Log("Code has already been used.");
                GameManager.Instance._NSCUIParent.SetActive(false);
                GameManager.Instance.adminPanel.SetActive(false);
                GameManager.Instance.numPad.SetActive(false);
                StartCoroutine(GameManager.Instance.deviceIDManager.CorrectId());
            }
            else if (msg == "Invalid code")
            {
                Debug.Log("Invalid code entered.");
                GameManager.Instance.adminPanel.SetActive(true);
                GameManager.Instance.numPad.SetActive(true);
                GameManager.Instance.numPadParent.SetActive(true);
                StartCoroutine(GameManager.Instance.deviceIDManager.WrongId());
            }
            else
            {
                Debug.Log("Unknown error: " + msg);
                StartCoroutine(GameManager.Instance.deviceIDManager.WrongId());
            }
        }
        else
        {
            StartCoroutine(GameManager.Instance.deviceIDManager.CorrectId());
            Debug.Log("Success! Device ID: " + (string)jObj["data"]["deviceId"]);
            DeviceRegisterResponsee response = JsonUtility.FromJson<DeviceRegisterResponsee>(responseText);

            if (response != null && response.status && response.data != null)
            {
                string vrId = response.data.device.deviceId;
                PlayerPrefs.SetString("VR_ID", vrId);
                PlayerPrefs.Save();
                StartCoroutine(GameManager.Instance.deviceIDManager.CorrectId());
                Debug.Log("VR ID saved in PlayerPrefs: " + vrId);
            }
            else
            {
                Debug.LogWarning("VR ID not found in response.");
                StartCoroutine(GameManager.Instance.deviceIDManager.WrongId());
            }
        }
    }

    #endregion

    #region API: Session Retrieval -------------------------------------

    public IEnumerator PostSessionId()
    {
        yield return new WaitForSeconds(1f);

        string retrieveSessionApiSessionId = retrieveSessionApi + GameManager.Instance.sessionId;

        if (string.IsNullOrEmpty(GameManager.Instance.sessionId))
        {
            Debug.LogWarning("⚠️ Session ID is null — cannot fetch journey data.");
            yield break;
        }

        UnityWebRequest request = UnityWebRequest.Get(retrieveSessionApiSessionId);
        request.SetRequestHeader("Content-Type", "application/json");
        request.certificateHandler = new BypassCertificateHandler();

        yield return request.SendWebRequest();

        if (request.result != UnityWebRequest.Result.Success)
        {
            Debug.LogError("❌ Error fetching session: " + request.error);
            yield break;
        }

        string json = request.downloadHandler.text;
        Debug.Log("✅ Journey Response: " + json);

        JObject parsedJson = JObject.Parse(json);
        string sessionType = parsedJson["data"]?["session_type"]?.ToString();
        GameManager.Instance.isGroupUser = (sessionType == "group");

        //if (GameManager.Instance.isGroupUser)
        //{
        //    GameManager.Instance.AVProParent.SetActive(true);
        //    GameManager.Instance.Environment.SetActive(false);
        //    GameManager.Instance.adminButton.SetActive(false);
        //    GameManager.Instance._NSCUIParent.SetActive(false);
        //    GameManager.Instance.messagePanel.SetActive(false);
        //}
        //else
        //{
        //    GameManager.Instance.AVProParent.SetActive(false);
        //    GameManager.Instance.Environment.SetActive(true);
        //    GameManager.Instance.adminButton.SetActive(false);
        //    GameManager.Instance._NSCUIParent.SetActive(true);
        //    //GameManager.Instance._NSCUI.SetActive(true);
        //    GameManager.Instance.messagePanel.SetActive(false);
        //}

        JourneyResponse response = JsonUtility.FromJson<JourneyResponse>(json);
        if (response == null || response.data == null || response.data.journeys == null)
        {
            Debug.LogWarning("⚠️ No journey data found in response.");
            yield break;
        }

        if (GameManager.Instance.isGroupUser)
            AssignJourneyData(response.data.journeys);
    }

    #endregion

   


    #region Group user Journey --------------------------------------------

    private void AssignJourneyData(JourneyWrapper[] journeys)
    {
        GameManager.Instance.videoTitle.Clear();
        GameManager.Instance.videoDesc.Clear();
        GameManager.Instance.videoUserSprites.Clear();
        GameManager.Instance.videoUrlList.Clear();
        GameManager.Instance.expAudioUrlList.Clear();
        GameManager.Instance.expAudioLangList.Clear();
        journeyDataDict.Clear();

        foreach (var j in journeys)
        {
            if (j == null || j.journey == null) continue;

            int journeyId = j.journey.id;
            string videoUrl = j.video != null ? j.video.url : "";
            string videoTitle = j.video != null ? j.video.title : j.journey.title;
            string videoDesc = j.video != null ? j.video.description : j.journey.description;
            string thumbnailUrl = j.video != null ? j.video.thumbnail_url : "";

            List<string> audioUrls = new List<string>();
            List<string> audioLangs = new List<string>();

            if (j.journey.audio_tracks != null)
            {
                foreach (var track in j.journey.audio_tracks)
                {
                    if (track.audio_track != null)
                    {
                        audioUrls.Add(track.audio_track.audio_url);
                        audioLangs.Add(track.audio_track.language_code);
                    }
                    else
                    {
                        audioUrls.Add(track.audio_url);
                        audioLangs.Add("unknown");
                    }
                }
            }

            GameManager.Instance.videoTitle.Add(videoTitle);
            GameManager.Instance.videoDesc.Add(videoDesc);
            GameManager.Instance.videoUserSprites.Add(null);
            GameManager.Instance.videoUrlList.Add(videoUrl);
            GameManager.Instance.expAudioUrlList.Add(audioUrls);
            GameManager.Instance.expAudioLangList.Add(audioLangs);
            GameManager.Instance.videoThumbnailUrlList.Add(thumbnailUrl);

            JourneyContent jc = new JourneyContent
            {
                journeyId = journeyId,
                videoUrl = videoUrl,
                videoTitle = videoTitle,
                videoDesc = videoDesc,
                audioUrls = audioUrls.ToArray(),
                audioLangs = audioLangs.ToArray()
            };

            if (!journeyDataDict.ContainsKey(journeyId))
                journeyDataDict.Add(journeyId, jc);
        }

        GameManager.Instance.videoButtonCount = journeys.Length;
        if (DynamicButtonController.Instance != null)
            Debug.Log($"✅ Stored {journeys.Length} journeys in dictionary for quick lookup.");
    }

    public JourneyContent GetJourneyById(int journeyId)
    {
        if (journeyDataDict.TryGetValue(journeyId, out JourneyContent content))
            return content;

        Debug.LogWarning($"⚠️ Journey ID {journeyId} not found in dictionary.");
        return null;
    }

    #endregion

    #region API: Thumbnails & Logs ------------------------------------

    public IEnumerator LoadThumbnail(string url, Image targetImage)
    {
        if (string.IsNullOrEmpty(url) || targetImage == null)
            yield break;

        UnityWebRequest request = UnityWebRequestTexture.GetTexture(url);
        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            Texture2D tex = DownloadHandlerTexture.GetContent(request);
            Sprite sprite = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f));
            targetImage.sprite = sprite;
        }
        else
        {
            Debug.Log("Error loading thumbnail: " + request.error);
        }
    }

    //public IEnumerator PostSessionLogApi()
    //{
    //    int durationSeconds = (int)(GameManager.Instance.mediaPlayer?.Info?.GetDuration() ?? 0);

    //    string sessionId = string.IsNullOrEmpty(GameManager.Instance.mqtt?._currentSessionId)
    //        ? ""
    //        : GameManager.Instance.mqtt._currentSessionId;

    //    string journeyId = string.IsNullOrEmpty(GameManager.Instance.mqtt?._currentJourneyId)
    //        ? "0"
    //        : GameManager.Instance.mqtt._currentJourneyId;

    //    string vrDeviceId = string.IsNullOrEmpty(GameManager.Instance.api?.vid)
    //        ? ""
    //        : GameManager.Instance.api.vid;

    //    float positionMs = GameManager.Instance.mqtt?._currentPositionMs ?? 0f;

    //    JObject json = new JObject
    //    {
    //        ["session_id"] = sessionId,
    //        ["event"] = "PLAYBACK_STARTED",
    //        ["journey_id"] = journeyId,
    //        ["start_time"] = string.IsNullOrEmpty(startTime) ? "" : startTime,
    //        ["end_time"] = string.IsNullOrEmpty(endTime) ? "" : endTime,
    //        ["duration_ms"] = durationSeconds,
    //        ["vr_device_id"] = vrDeviceId,
    //        ["position_ms"] = positionMs,
    //        ["error_code"] = "NONE",
    //        ["error_message"] = "",
    //        ["details"] = new JObject { ["note"] = "User pressed start" },
    //        ["metadata"] = new JObject { ["appVersion"] = "1.0.0" }
    //    };

    //    using (UnityWebRequest request = new UnityWebRequest(sessionLogApi, "POST"))
    //    {
    //        byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json.ToString());
    //        request.uploadHandler = new UploadHandlerRaw(bodyRaw);
    //        request.downloadHandler = new DownloadHandlerBuffer();
    //        request.SetRequestHeader("Content-Type", "application/json");

    //        yield return request.SendWebRequest();

    //        if (request.result == UnityWebRequest.Result.Success)
    //        {
    //            Debug.Log($"✅ POST Success: {request.downloadHandler.text}");
    //            //GameManager.Instance.mqtt.RestartScene();
    //        }
    //        else
    //        {
    //            Debug.LogError($"❌ POST Failed: {request.error}\nResponse: {request.downloadHandler.text}");
    //            //GameManager.Instance.mqtt.RestartScene();
    //        }
    //    }
    //}

    #endregion

    #region Time Utilities ---------------------------------------------

    public static string GetCurrentTimestamp() => DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ");
    public void StartTime() => startTime = GetCurrentTimestamp();
    public void EndTime() => endTime = GetCurrentTimestamp();

    #endregion

    #region Certificate Handler ---------------------------------------

    private class BypassCertificateHandler : CertificateHandler
    {
        protected override bool ValidateCertificate(byte[] certificateData) => true;
    }

    #endregion
}

