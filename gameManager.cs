using System.Collections.Generic;
using UnityEngine;
using RenderHeads.Media.AVProVideo;
using TMPro;
using Oculus.Interaction;
using UnityEngine.SceneManagement;

public class GameManager : MonoBehaviour
{
    // Singleton
    public static GameManager Instance { get; private set; }

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
    }

    [Header("Video Selections")]
    public DynamicButtonController dynamicButtonController;
    public Transform videoSelectionButtonParent;
    public GameObject videoButtonPrefab;
    public int videoButtonCount;
    public List<Sprite> videoUserSprites;
    public List<string> videoTitle;
    public List<string> videoDesc;
    public List<string> videoUrlList = new List<string>();
    public List<string> videoJourneyIds = new List<string>();
    public List<string> videoThumbnailUrlList = new List<string>();

    [Header("Audio Selections")]
    public AudioSource audioSource;
    public Transform audioSelectionButtonParent;
    public GameObject audioButtonPrefab;
    public int audioButtonCount;
    public List<string> audioUserTexts;
    public GameObject backButton;
    public List<List<string>> expAudioUrlList = new List<List<string>>();
    public List<List<string>> expAudioLangList = new List<List<string>>();

    [Header("Video Player & UI")]
    public GameObject AVProParent;
    public GameObject Environment;
    public MediaPlayer mediaPlayer;
    public GameObject _NSCUIParent;
    public GameObject _NSCUI;
    public GameObject videoSelectionParent;
    public GameObject audioSelectionParent;
    public GameObject scriptsHandler;

    [Header("Dynamic UI Buttons Ref")]
    public InteractableUnityEventWrapper leftArrow;
    public InteractableUnityEventWrapper rightArrow;
    public GameObject targetObjectVideo, targetObjectAudio;

    [Header("Device Register Panel")]
    public DeviceIDManager deviceIDManager;
    public GameObject numPadParent;
    public GameObject wrongPanel;
    public GameObject truePanel;
    public GameObject messagePanel;
    public TextMeshProUGUI messagePanelText;
    public GameObject adminPanel;
    public GameObject adminButton;
    public GameObject numPad;
    public bool isSubmitClicked = false;

    [Header("API")]
    public APIManager api;
    public string _IP;
    public MqttDeviceManager mqtt;

    [Header("Individual User")]
    public GameObject videoButtonController;
    public InteractableUnityEventWrapper playWrapper;
    public InteractableUnityEventWrapper pauseWrapper;
    public InteractableUnityEventWrapper homeWrapper;
    public string eventType;

    [Header("Common")]
    [HideInInspector] public bool isGroupUser;
    [HideInInspector] public bool isFirst = false;
    [HideInInspector] public bool isStart = false;
    public string sessionId;             // Journey SessionId
    public string panelSelectionName;    // UI Panel Selection Video&Audio


    public void RestartScene()
    {
        SceneManager.LoadScene(SceneManager.GetActiveScene().buildIndex);
    }

    /// <summary>
    /// Get the index in videoUrlList/videoJourneyIds by journey ID.
    /// Returns -1 if not found.
    /// </summary>
    public int GetIndexByJourneyId(int journeyId)
    {
        string journeyIdStr = journeyId.ToString();
        
        // Search in videoJourneyIds list to find the matching index
        for (int i = 0; i < videoJourneyIds.Count; i++)
        {
            if (videoJourneyIds[i] == journeyIdStr)
            {
                Debug.Log($"[GameManager] Found journey {journeyId} at index {i}");
                return i;
            }
        }
        
        Debug.LogWarning($"[GameManager] Journey ID {journeyId} not found in videoJourneyIds list. Available IDs: {string.Join(", ", videoJourneyIds)}");
        return -1;
    }

    /// <summary>
    /// Get video URL by journey ID directly
    /// </summary>
    public string GetVideoUrlByJourneyId(int journeyId)
    {
        int index = GetIndexByJourneyId(journeyId);
        if (index >= 0 && index < videoUrlList.Count)
        {
            return videoUrlList[index];
        }
        return null;
    }

    /// <summary>
    /// Get audio URLs by journey ID
    /// </summary>
    public List<string> GetAudioUrlsByJourneyId(int journeyId)
    {
        int index = GetIndexByJourneyId(journeyId);
        if (index >= 0 && index < expAudioUrlList.Count)
        {
            return expAudioUrlList[index];
        }
        return null;
    }

    /// <summary>
    /// Get audio languages by journey ID
    /// </summary>
    public List<string> GetAudioLangsByJourneyId(int journeyId)
    {
        int index = GetIndexByJourneyId(journeyId);
        if (index >= 0 && index < expAudioLangList.Count)
        {
            return expAudioLangList[index];
        }
        return null;
    }
}
