/**
 * @file
 * Enables client side uploading of files to S3.
 */

(function ($) {
  S3fsCORSUpload = {};
  Drupal.behaviors.S3fsCORSUpload = {};
  
  S3fsCORSUpload.handleUpload = function(file_input, remaining_inputs, button_name) {
    var form = file_input.closest('form');
    var widget = file_input.parent();
    // The name of the file that Drupal returns from the signing request.
    // We declare it here so multiple functions can access it.
    var file_real = null;
    
    // Don't do anything if the <input> is empty.
    if (!file_input.val()) {
      return;
    }
    
    if (file_input[0].files === undefined || window.FormData === undefined) {
      // If we're in IE8/9, or the FormData API is unavailable, fall back to
      // a non-CORS upload.
      // TODO: Non-CORS upload.
      alert('CORS Upload is not supported in IE8 or 9. Sorry.');
      return;
    }
    
    // For now, we only support single-value file fields.
    var file_obj = file_input[0].files[0];
    
    // Disable all the submit buttons, so users can't accidentally mess
    // up the workflow. We'll submit the form via JS after file uploads
    // are complete.
    form.find('input[type="submit"]').prop('disabled', 'disabled');
    
    var progress_bar = $('<div>', {
      id: 's3fs-cors-progress',
      style: 'width: 270px; min-height: 2em; float: left; text-align: center; line-height: 2em; margin-right: 5px;',
      text: Drupal.t('Preparing upload ...'),
    });

    // Replace the file <input> with our progress bar.
    file_input.hide().after(progress_bar);
    
    // This function undoes the form alterations we made.
    function form_cleanup () {
      file_input.show();
      progress_bar.remove();
      form.find('input[type="submit"]').prop('disabled', false);
    }
    
    // Step 1: Get the signed S3 upload form from Drupal.
    $.ajax({
      url: '/ajax/s3fs_cors',
      type: 'POST',
      data: {
        filename: file_obj.name,
        filemime: file_obj.type,
        // Need this to look up the form during our signing request.
        form_build_id: form.find('input[name="form_build_id"]').val()
      },
      error: function(jqXHR, textStatus, errorThrown) {
        alert('An error occured while preparing to upload the file to S3:\n' + jqXHR.responseJSON.error);
        form_cleanup();
      },
      success: upload_to_s3,
    });

    // Step 2: With the signed form data, perform the CORS upload to S3.
    function upload_to_s3 (data, textStatus, jqXHR) {
      // Use the HTML5 FormData API to build a POST form to send to S3.
      var fd = new FormData();
      // Use the signed form data returnd from /ajax/s3fs_cors.
      $.each(data.inputs, function(key, value) {
        fd.append(key, value);
      });
      fd.append('file', file_obj);
      // Save the filename returned from Drupal so that submit_to_drupal()
      // can access it.
      file_real = data.file_real;

      // Send the AJAX request to S3.
      $.ajax({
        // data.form.action is the S3 URL to which this upload will be POSTed.
        url: data.form.action,
        type: 'POST',
        mimeType: 'multipart/form-data',
        data: fd,
        cache: false,
        contentType: false,
        processData: false,
        xhrFields: {
          withCredentials: true
        },
        xhr: function() {
          // Alter the XMLHTTPRequest to make it use our progressbar code.
          var the_xhr = $.ajaxSettings.xhr();
          if (the_xhr.upload) {
            the_xhr.upload.onprogress = S3fsCORSUpload.displayProgress;
          }
          return the_xhr;
        },
        error: function(jqXHR, textStatus, errorThrown) {
          alert('An error occured during the upload to S3: ' + errorThrown);
          form_cleanup();
        },
        complete: submit_to_drupal
      });
    }

    // Step 3: Update the file metadata and submit the form to Drupal.
    function submit_to_drupal (data, textStatus, jqXHR) {
      // Update the metadata fields for the file we just uploaded.
      widget.find('input.filemime').val(file_obj.type);
      widget.find('input.filesize').val(file_obj.size);
      widget.find('input.filename').val(file_real);
      
      // In an upload button press, remaining_inputs will be undefined. But in
      // a form submission, remaining_inputs will be sent in as an integer
      // When it's 0, there are no files left to upload, so we execute the full
      // form submission.
      if (remaining_inputs === 0) {
        // Remove our submit handler first, so we don't infinitely loop.
        form.unbind('submit');
        // Add the "op" value back into the form. It would have been included
        // by the clicking of any of the submit buttons, but since we took
        // over, we need to add it back in manually.
        form.append($('<input>', {
          name: 'op',
          value: button_name
        }));
        form.submit();
      }
      else {
        // Re-enable all the submit buttons in the form.
        form.find('input[type="submit"]').prop('disabled', false);
        
        // TODO: This line probably needs a tweak for multi-value file fields.
        var button_id = widget.find('input.cors-form-submit').attr('id');
        var ajax = Drupal.ajax[button_id];
        // Remove the file itself from the form, to avoid sending it to Drupal.
        $(ajax.form[0]).find('#' + file_input.attr('id')).remove();
        // Submit the widget's subform to Drupal, to inform Drupal that the
        // file now exists.
        ajax.form.ajaxSubmit(ajax.options);
      }
    }
  };
  
  /**
   * Receives an XMLHttpRequestProgressEvent and uses it to display current
   * progress if possible.
   *
   * @param event
   *   And XMLHttpRequestProgressEvent object.
   */
  S3fsCORSUpload.displayProgress = function(event) {
    if (event.lengthComputable) {
      var progress = $('#s3fs-cors-progress');
      // Remove the placeholder text at the last possible moment. But don't mess
      // with progress.text after that, or we'll destroy the progress bar.
      if (progress.text() == Drupal.t('Preparing upload ...')) {
        progress.text('');
      }
      percent = Math.floor((event.loaded / event.total) * 100);
      progress.progressbar({value: percent});
      return true;
    }
  };
  
  /**
   * Implements Drupal.behaviors.
   */
  Drupal.behaviors.S3fsCORSUpload.attach = function(context, settings) {
    var upload_button = $('input.cors-form-submit', context);
    // We need to use jQuery.once() here because Drupal runs the attach function
    // multiple times for some reason.
    upload_button.once('s3fs_cors_upload', function() {
      // Prevent Drupal's AJAX file upload code from running.
      upload_button.unbind('mousedown');
      
      // Run our AJAX file upload code when the user clicks the Upload button.
      // Since this attach function will get run again the next time the Upload button
      // appears, we can use jQuery.one() to ensure that the user doesn't accidentally
      // start the upload multiple times.
      upload_button.one('click', function(e) {
        var file_input = $(this).siblings('.s3fs-cors-upload-file');
        S3fsCORSUpload.handleUpload(file_input);
        return false;
      });
    });
    
    $('form.s3fs-cors-upload-form', context).once('s3fs_cors_form', function() {
      $(this).submit(function(event) {
        // Get the list of CORS <input>s which have values.
        var filled_file_inputs = $('input.s3fs-cors-upload-file', this).filter(
          function() { return $(this).val(); }
        );

        if (filled_file_inputs.length) {
          var clicked_button = $(this).find('input[type="submit"]:focus');
          var button_name = clicked_button.val();
          if (button_name == 'Delete') {
            // If the Delete button was pressed, submit the form as normal.
            return true;
          }
          else if (button_name == 'Preview') {
            // Because I haven't found any way to mess with the final file
            // submission mechanism (ajax.form.ajaxSubmit above), we can't
            // successfully perform CORS uploads during a preview submit,
            // because the page will change and javascript execution will die
            // before the ajax metadata upload is complete. Save submits don't
            // require ajax metadata upload.
            alert('Please upload all file fields before previewing this node.');
            event.preventDefault();
            event.stopPropagation();
            return false;
          }

          // Add a throbber next to the button that got pressed, to inform the
          // user about the CORS uploads that may not be currently visible.
          var throbber = $('<div class="ajax-progress ajax-progress-throbber cors"><div class="throbber">&nbsp;</div></div>');
          $('.throbber', throbber).after('<div class="message" style="margin-right: 15px">CORS Uploads in progress...</div>');
          $(clicked_button).after(throbber);

          // Loop through all the filled CORS <input>s and handle their uploads.
          // The last will perform the full form submission.
          filled_file_inputs.each(function(ndx, file_input) {
            file_input = $(file_input);
            var remaining_inputs = filled_file_inputs.length - (ndx+1);
            S3fsCORSUpload.handleUpload(file_input, remaining_inputs, button_name);
          });
          event.preventDefault();
          event.stopPropagation();
          return false;
        }
        else {
          // If there were no CORS uploads to perform, submit the form as normal.
          return true;
        }
      });
    });
  };
})(jQuery);
