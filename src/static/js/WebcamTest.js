var webcam = null;

//Assuming using jQuery, lets wait until the document has finished loading. 
$(document).ready(function () {
    //This reaches out to KioskSimple and requests API initialization
    try{
        window.external.KioskSimpleAPIInit();
    }
    catch (err) {

        //If we got here then we are not running within KioskSimple, lets disable all buttons and output to user
        $("#btnEnableWebcam").prop('disabled', true);
        $("#btnDisableWebcam").prop('disabled', true);
       
        outputActionResult("Initialization", "Something went wrong intitializing KioskSimple. Error:" + err)
        return;
    }
    //If we got this far, we are successfully running within KioskSimple's local code domain
    if (K()) {
        // hook up handler for snapshot async action
        webcam = KioskSimple.Plugins.GetPlugin("Webcam");
        if (webcam != null) {
            webcam.OnSnapshot = OnSnapshot;
            webcam.OnEnabled = OnEnabled;
            webcam.OnDisabled = OnDisabled;
            webcamOnError = OnError;

            setupUIButtons();
            outputActionResult("Initialization", "Kiosk Simple loaded.")
        }
       
    }

});

//Not 100% needed but a nice shortcut to determine if KS is preset.
function K() {
    return !(typeof KioskSimple === 'undefined')
}

function OnDisabled() {
    outputActionResult("Disabled", "Disabled")
}

function OnEnabled() {
    outputActionResult("Enabled", "Enabled")
}

function OnError(err) {
    outputActionResult("Error", err)
}

//Plugin Snapshot handler, this will fire when the TakeSnapshotAsyn method of the webcam is executed.
function OnSnapshot(path, filename) {
   
    outputActionResult("OnSnapshot","Path:"+path+",filename:"+filename )
}


function setupUIButtons() {
    $("#btnEnableWebcam").click(function () {
        KioskSimple.Plugins.GetPlugin('_devices').EnableAllDevicesByCategory("Camera");
    });

    $("#btnDisableWebcam").click(function () {
        KioskSimple.Plugins.GetPlugin('_devices').DisableAllDevicesByCategory("Camera");
    });

    $("#btnTakeSnapshot").click(function () {

        if (webcam.Enabled()) {
			outputActionResult("Taking", {})
            var result = webcam.TakeSnapshot("myfileid");
			
            outputActionResult("Snapshot taken", result)
        }

    });
    
    $("#btnTakeSnapshotAsync").click(function () {
        if (webcam.Enabled()) {
            webcam.TakeSnapshotAsync("myfileidasync");
            //OnSnapshot handler will execute upon completion of this action
        }
    });

    $("#btnIsEnabled").click(function () {
        
            var result = webcam.Enabled();
            outputActionResult("IsEnabled", result)
            //OnSnapshot handler will execute upon completion of this action
        
    });

}

function outputActionResult(actionName, data) {
    var output = "<a href='#' class='list-group-item'><h4 class='list-group-item-heading'>Action Result: " + actionName + "</h4><p class='list-group-item-text'>" + data + "</p></a>";
    $(".list-group").append(output);
}


