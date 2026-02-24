package tr.org.lider.repositories;

import java.util.List;

import javax.transaction.Transactional;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import tr.org.lider.entities.CommandImpl;
import tr.org.lider.entities.TaskImpl;

/**
 *
 */
public interface CommandRepository extends BaseJpaRepository<CommandImpl, Long>{

	List<CommandImpl> findByTask(TaskImpl task );
	List<CommandImpl> findAllByDnListJsonStringContaining(String dnListJsonString);
	List<CommandImpl> findAllByUidListJsonStringContaining(String uidListJsonString);
	

	@Query("SELECT c.task, ce, c.commandOwnerUid, c.id "
			+ "FROM CommandImpl c "
			+ "LEFT OUTER JOIN c.commandExecutions ce "
			+ "LEFT OUTER JOIN c.task t "
			+ "WHERE ce.dn =?1 "
			+ "AND c.task IS NOT NULL "
			+ "ORDER BY c.createDate DESC")
	List<Object[]> findCommandsOfAgent(String dn);
	
	@Query("SELECT c "
			+ "FROM CommandImpl c "
			+ "LEFT OUTER JOIN c.policy p "
			+ "WHERE c.dnListJsonString LIKE %?2% "
			+ "AND p.id = ?1 "
			+ "AND c.deleted = False")
	List<CommandImpl> findByPolicyAndDn(Long id, String dn);
	
	@Query("SELECT c "
			+ "FROM CommandImpl c "
			+ "LEFT OUTER JOIN c.policy p "
			+ "WHERE c.dnListJsonString LIKE %?1% "
			+ "AND c.deleted = False")
	List<CommandImpl> findAllPolicyByDn(String dn);
	
	@Transactional
	@Modifying(clearAutomatically = true)
    @Query("UPDATE CommandImpl ce SET ce.dnListJsonString = :newDN WHERE ce.id = :commandID")
    int updateAgentDN(@Param("commandID") Long commandID, @Param("newDN") String newDN);
	
	void deleteByUidListJsonString(String uidListJsonString);
	
	List<CommandImpl> findByUidListJsonStringContaining(String uid);
	
	@Query("SELECT c FROM CommandImpl c WHERE c.policy is not null")
	List<CommandImpl> findCommandAllByPolicy();
	
	@Query("SELECT c FROM CommandImpl c WHERE c.id = :commandId")
	List<CommandImpl> findCommandId(@Param("commandId") Long commandId);
}
