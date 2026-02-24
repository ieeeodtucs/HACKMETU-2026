package tr.org.lider.services;

import java.util.Date;
import java.util.List;

import org.slf4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import tr.org.lider.entities.CommandExecutionImpl;
import tr.org.lider.entities.CommandImpl;
import tr.org.lider.entities.TaskImpl;
import tr.org.lider.message.service.IMessagingService;
import tr.org.lider.messaging.messages.ExecuteTaskMessageImpl;
import tr.org.lider.messaging.messages.FileServerConf;
import tr.org.lider.messaging.messages.ILiderMessage;
import tr.org.lider.repositories.CommandExecutionRepository;
import tr.org.lider.repositories.CommandRepository;
import tr.org.lider.repositories.TaskRepository;
import tr.org.lider.utils.IRestResponse;
import tr.org.lider.utils.ResponseFactoryService;
import tr.org.lider.utils.RestResponseStatus;


@Service
public class TaskSchedulerService {
	
	@Autowired
	private TaskRepository taskRepository;
	
	@Autowired
	private CommandExecutionRepository commandExecutionRepository;
	
	@Autowired
	private CommandRepository commandRepository;
	
	@Autowired
	private IMessagingService messagingService;
	
	@Autowired
	private ConfigurationService configService;
	
	@Autowired
	private ConfigurationService configurationService;
	
	@Autowired
	private ResponseFactoryService responseFactoryService;
	
	private final Logger logger = org.slf4j.LoggerFactory.getLogger(this.getClass());

	
	public IRestResponse sendScheduledTaskMesasage() throws Throwable {
		
		ILiderMessage scheduledMessage = null;
		List<CommandExecutionImpl> executionList = null;
		String taskJsonString = null;
		Long taskId = taskRepository.findByTaskId().get(0).longValue();	
		
		if(taskId != null) {
			executionList = commandExecutionRepository.findCommandExecution(taskId);
		}
		
		try {
			if(executionList != null) {
				int limit = Math.min(configurationService.getClientSize(), executionList.size());

				for(int i=0;i<limit;i++) {		
					
					List<CommandImpl> commandList = commandRepository.findCommandId(executionList.get(i).getCommand().getId());
					List<TaskImpl> taskList = taskRepository.findByTask(commandList.get(0).getTask().getId());

					executionList.get(i).setCommanSend(true);
					commandExecutionRepository.save(executionList.get(i));
					
					taskJsonString = taskList.get(0).toString();
					FileServerConf fileServerConf=taskList.get(0).getPlugin().isUsesFileTransfer() ? configService.getFileServerConf(executionList.get(i).getUid().toLowerCase()) : null;

					scheduledMessage = new ExecuteTaskMessageImpl(taskJsonString, executionList.get(i).getUid(), new Date(), fileServerConf);
					messagingService.sendMessage(scheduledMessage);
					
				}
			}
			
		} 
		catch (IndexOutOfBoundsException e) {
			logger.error("Expected list is emty" + e.getMessage());
		}
		return responseFactoryService.createResponse(RestResponseStatus.OK,"Task Basarı ile Gonderildi.");
				
	}
	
}